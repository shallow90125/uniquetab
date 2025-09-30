/**
 * TabManager
 * タブの管理と統合処理を行うサービスクラス
 */

// ログユーティリティ
class Logger {
  static info(message, data = null) {
    console.log(`[UniqueTab] ${message}`, data || "");
  }

  static warn(message, data = null) {
    console.warn(`[UniqueTab] ${message}`, data || "");
  }

  static error(message, error = null) {
    console.error(`[UniqueTab] ${message}`, error || "");
  }
}

class TabManager {
  constructor(bookmarkService, settingsService) {
    this.bookmarkService = bookmarkService;
    this.settingsService = settingsService;
    this.processingTabs = new Set(); // 処理中のタブIDを記録
  }

  /**
   * タブ作成イベントの処理
   * @param {chrome.tabs.Tab} tab
   */
  async handleTabCreated(tab) {
    try {
      // URLがまだ設定されていない場合はスキップ
      if (
        !tab.url ||
        tab.url === "chrome://newtab/" ||
        tab.url === "about:blank"
      ) {
        return;
      }

      await this.processTabUrl(tab.id, tab.url);
    } catch (error) {
      Logger.error("Error handling tab created", error);
    }
  }

  /**
   * タブ更新イベントの処理
   * @param {number} tabId
   * @param {Object} changeInfo
   * @param {chrome.tabs.Tab} tab
   */
  async handleTabUpdated(tabId, changeInfo, tab) {
    try {
      Logger.info("Tab updated event", { tabId, changeInfo, url: tab.url });

      // URLが変更された場合のみ処理
      if (!changeInfo.url) {
        return;
      }

      // URLが変更されたら即座に処理
      await this.processTabUrl(tabId, changeInfo.url);
    } catch (error) {
      Logger.error("Error handling tab updated", error);
    }
  }

  /**
   * タブのURLを処理して統合が必要か判定・実行
   * @param {number} tabId
   * @param {string} url
   */
  async processTabUrl(tabId, url) {
    const startTime = performance.now();

    try {
      Logger.info("Processing tab URL", { tabId, url });

      // 既に処理中の場合はスキップ
      if (this.processingTabs.has(tabId)) {
        Logger.info("Tab already being processed, skipping", { tabId });
        return;
      }

      this.processingTabs.add(tabId);

      // 拡張機能が無効の場合はスキップ
      const isEnabled = await this.settingsService.isEnabled();
      Logger.info("Extension enabled status", { isEnabled });
      if (!isEnabled) {
        Logger.info("Extension is disabled, skipping tab processing");
        return;
      }

      // ブックマークに登録されているか確認
      const isBookmarked = await this.bookmarkService.isUrlBookmarked(url);
      Logger.info("Bookmark check result", { url, isBookmarked });
      if (!isBookmarked) {
        Logger.info("URL is not bookmarked, skipping", { url });
        return;
      }

      // 既存タブを検索
      const existingTab = await this.findExistingTab(url, tabId);
      if (!existingTab) {
        Logger.info("No existing tab found, keeping new tab", { tabId, url });
        return;
      }

      Logger.info("Found duplicate tab, will merge", {
        newTabId: tabId,
        existingTabId: existingTab.id,
      });

      // 既存タブに遷移して新しいタブを削除
      await this.mergeToExistingTab(existingTab.id, tabId);

      // 統計情報を更新
      await this.settingsService.incrementMergedTabs();

      const elapsed = performance.now() - startTime;
      Logger.info(`Tab merged successfully in ${elapsed.toFixed(2)}ms`, {
        newTabId: tabId,
        existingTabId: existingTab.id,
        url,
      });
    } catch (error) {
      Logger.error("Error processing tab URL", error);
    } finally {
      this.processingTabs.delete(tabId);
    }
  }

  /**
   * 同じURLを持つ既存タブを検索
   * @param {string} url
   * @param {number} excludeTabId - 検索から除外するタブID
   * @returns {Promise<chrome.tabs.Tab|null>}
   */
  async findExistingTab(url, excludeTabId) {
    try {
      const tabs = await chrome.tabs.query({});

      for (const tab of tabs) {
        // 自分自身と異なるタブで、同じURLを持つタブを検索
        if (tab.id !== excludeTabId && tab.url === url) {
          Logger.info("Found existing tab", { id: tab.id, url: tab.url });
          return tab;
        }
      }

      return null;
    } catch (error) {
      Logger.error("Error finding existing tab", error);
      return null;
    }
  }

  /**
   * 既存タブに遷移して新しいタブを削除
   * @param {number} existingTabId
   * @param {number} newTabId
   */
  async mergeToExistingTab(existingTabId, newTabId) {
    try {
      // 既存タブをアクティブにする
      await this.switchToTab(existingTabId);

      // 少し待ってから新しいタブを削除（遷移完了を確保）
      await this.delay(100);

      // 新しいタブを削除
      await this.removeTab(newTabId);

      Logger.info("Tab merge completed", { existingTabId, newTabId });
    } catch (error) {
      Logger.error("Error merging tabs", error);
      throw error;
    }
  }

  /**
   * 指定されたタブに遷移
   * @param {number} tabId
   */
  async switchToTab(tabId) {
    try {
      // タブをアクティブにする
      await chrome.tabs.update(tabId, { active: true });

      // タブの情報を取得してウィンドウを前面に表示
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });

      Logger.info("Switched to tab", { tabId, windowId: tab.windowId });
    } catch (error) {
      Logger.error("Error switching to tab", error);
      throw error;
    }
  }

  /**
   * タブを削除
   * @param {number} tabId
   */
  async removeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      Logger.info("Tab removed", { tabId });
    } catch (error) {
      // タブが既に閉じられている場合などはエラーを無視
      if (error.message && error.message.includes("No tab with id")) {
        Logger.warn("Tab already closed", { tabId });
      } else {
        throw error;
      }
    }
  }

  /**
   * 指定時間待機
   * @param {number} ms
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// TabManagerクラスをグローバルスコープに公開
self.TabManager = TabManager;
