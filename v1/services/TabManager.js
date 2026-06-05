/**
 * TabManager
 * タブの管理と統合処理を行うサービスクラス
 */

// PinnedTabServiceをインポート
import "./PinnedTabService.js";

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
  constructor(settingsService) {
    this.settingsService = settingsService;
    this.pinnedTabService = self.pinnedTabService;
    this.processingTabs = new Set(); // 処理中のタブIDを記録
    this.maxRetries = 3; // 最大リトライ回数
    this.retryDelay = 1000; // リトライ間隔（ms）
    this.initializePinnedTabService();
  }

  /**
   * PinnedTabServiceを初期化
   */
  async initializePinnedTabService() {
    try {
      await this.pinnedTabService.initialize();
      Logger.info("PinnedTabService initialized in TabManager");
    } catch (error) {
      Logger.error("Failed to initialize PinnedTabService", error);
    }
  }

  /**
   * タブ作成イベントの処理
   * @param {chrome.tabs.Tab} tab
   */
  async handleTabCreated(tab) {
    try {
      Logger.info("Tab created event", {
        tabId: tab.id,
        url: tab.url,
        pinned: tab.pinned,
      });

      // ピン留めされたタブは処理しない
      if (tab.pinned) {
        Logger.info("Tab is pinned, skipping", { tabId: tab.id });
        return;
      }

      // URLがまだ設定されていない場合はスキップ（onUpdatedで処理される）
      if (
        !tab.url ||
        tab.url === "chrome://newtab/" ||
        tab.url === "about:blank"
      ) {
        Logger.info("Tab URL not ready yet, will process on update", {
          tabId: tab.id,
          url: tab.url,
        });
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
      // ピン留めされたタブは処理しない
      if (tab.pinned) {
        return;
      }

      // URLが変更された場合、またはステータスがcompleteになった場合に処理
      const urlChanged =
        changeInfo.url &&
        changeInfo.url !== "chrome://newtab/" &&
        changeInfo.url !== "about:blank";
      const loadingComplete =
        changeInfo.status === "complete" &&
        tab.url &&
        tab.url !== "chrome://newtab/" &&
        tab.url !== "about:blank";

      if (!urlChanged && !loadingComplete) {
        return;
      }

      Logger.info("Tab updated event - processing", {
        tabId,
        url: tab.url,
        urlChanged,
        loadingComplete,
        status: changeInfo.status,
      });

      // URLが変更された場合はそのURLを、そうでなければ現在のURLを処理
      const urlToProcess = changeInfo.url || tab.url;
      await this.processTabUrl(tabId, urlToProcess);
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

      // ピン留めされたタブを検索（完全一致）
      const pinnedTab = await this.findPinnedTab(url, tabId);
      Logger.info("Pinned tab check result", { url, found: !!pinnedTab });
      if (!pinnedTab) {
        Logger.info("No pinned tab found for this URL, keeping new tab", {
          tabId,
          url,
        });
        return;
      }

      Logger.info("Found pinned tab with same URL, will merge", {
        newTabId: tabId,
        pinnedTabId: pinnedTab.id,
      });

      // ピン留めタブに遷移して新しいタブを削除
      await this.switchToPinnedTab(pinnedTab.id, tabId);

      // 統計情報を更新
      await this.settingsService.incrementMergedTabs();

      const elapsed = performance.now() - startTime;
      Logger.info(`Tab merged successfully in ${elapsed.toFixed(2)}ms`, {
        newTabId: tabId,
        pinnedTabId: pinnedTab.id,
        url,
      });
    } catch (error) {
      Logger.error("Error processing tab URL", error);
    } finally {
      this.processingTabs.delete(tabId);
    }
  }

  /**
   * 同じURLを持つピン留めタブを検索
   * @param {string} url
   * @param {number} excludeTabId - 検索から除外するタブID
   * @returns {Promise<Object|null>} ピン留めタブ情報
   */
  async findPinnedTab(url, excludeTabId) {
    try {
      const pinnedTab = await this.pinnedTabService.findPinnedTabByUrl(url);

      // 除外するタブIDと一致する場合はnullを返す
      if (pinnedTab && pinnedTab.id === excludeTabId) {
        return null;
      }

      return pinnedTab;
    } catch (error) {
      Logger.error("Error finding pinned tab", error);
      return null;
    }
  }

  /**
   * ピン留めタブに遷移して新しいタブを削除
   * @param {number} pinnedTabId
   * @param {number} newTabId
   */
  async switchToPinnedTab(pinnedTabId, newTabId) {
    try {
      // ピン留めタブをアクティブにする
      await this.switchToTab(pinnedTabId);

      // 少し待ってから新しいタブを削除（遷移完了を確保）
      await this.delay(100);

      // 新しいタブを削除
      await this.removeTab(newTabId);

      Logger.info("Tab merge completed", { pinnedTabId, newTabId });
    } catch (error) {
      Logger.error("Error merging tabs", error);
      throw error;
    }
  }

  /**
   * 指定されたタブに遷移（リトライ機能付き）
   * @param {number} tabId
   */
  async switchToTab(tabId) {
    return await this.retryOperation(async () => {
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
    }, "switchToTab");
  }

  /**
   * 全てのタブを取得
   * @returns {Promise<Array<chrome.tabs.Tab>>}
   */
  async getAllTabs() {
    try {
      return await chrome.tabs.query({});
    } catch (error) {
      Logger.error("Error getting all tabs", error);
      return [];
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

  /**
   * リトライ機能を持つ操作実行
   * @param {Function} operation - 実行する非同期関数
   * @param {string} operationName - 操作名（ログ用）
   * @param {number} maxRetries - 最大リトライ回数（デフォルト: this.maxRetries）
   * @returns {Promise<any>}
   */
  async retryOperation(operation, operationName, maxRetries = this.maxRetries) {
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          this.timeout(5000, `${operationName} timeout`),
        ]);
      } catch (error) {
        lastError = error;
        Logger.warn(
          `${operationName} failed (attempt ${attempt}/${maxRetries})`,
          error
        );

        if (attempt < maxRetries) {
          await this.delay(this.retryDelay);
        }
      }
    }

    Logger.error(`${operationName} failed after ${maxRetries} attempts`);
    throw lastError;
  }

  /**
   * タイムアウト処理
   * @param {number} ms - タイムアウト時間（ミリ秒）
   * @param {string} message - タイムアウトメッセージ
   * @returns {Promise<never>}
   */
  timeout(ms, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}

// TabManagerクラスをグローバルスコープに公開
self.TabManager = TabManager;
