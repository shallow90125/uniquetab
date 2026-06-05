/**
 * PinnedTabService
 * ピン留めタブの検索と判定を行うサービスクラス
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

class PinnedTabService {
  constructor() {
    this.pinnedTabsCache = new Map(); // URL -> Tab情報のキャッシュ
    this.cacheInitialized = false;
    this.setupPinnedTabChangeListener();
  }

  /**
   * 初期化: ピン留めタブキャッシュを構築
   */
  async initialize() {
    if (this.cacheInitialized) {
      return;
    }

    try {
      await this.refreshCache();
      this.cacheInitialized = true;
      Logger.info("PinnedTabService initialized");
    } catch (error) {
      Logger.error("Failed to initialize PinnedTabService", error);
    }
  }

  /**
   * ピン留めタブキャッシュを更新
   */
  async refreshCache() {
    try {
      const startTime = performance.now();
      this.pinnedTabsCache.clear();

      // 全てのタブを取得
      const tabs = await chrome.tabs.query({});

      // ピン留めされたタブのみをキャッシュに追加
      for (const tab of tabs) {
        if (tab.pinned && tab.url) {
          const normalizedUrl = this.normalizeUrl(tab.url);
          this.pinnedTabsCache.set(normalizedUrl, {
            id: tab.id,
            windowId: tab.windowId,
            url: tab.url,
            normalizedUrl: normalizedUrl,
            title: tab.title,
          });
          Logger.info("Added pinned tab to cache", {
            id: tab.id,
            url: tab.url,
            normalizedUrl: normalizedUrl,
          });
        }
      }

      const elapsed = performance.now() - startTime;
      Logger.info(`Pinned tabs cache refreshed in ${elapsed.toFixed(2)}ms`, {
        count: this.pinnedTabsCache.size,
        urls: Array.from(this.pinnedTabsCache.keys()),
      });
    } catch (error) {
      Logger.error("Failed to refresh pinned tabs cache", error);
      throw error;
    }
  }

  /**
   * 指定されたURLのピン留めタブを検索
   * @param {string} url - 検索対象のURL
   * @returns {Promise<Object|null>} ピン留めタブ情報、見つからない場合はnull
   */
  async findPinnedTabByUrl(url) {
    if (!url) {
      return null;
    }

    // chrome:// や about: などの内部URLは対象外
    if (this.isInternalUrl(url)) {
      return null;
    }

    // キャッシュが初期化されていない場合は初期化
    if (!this.cacheInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    const normalizedUrl = this.normalizeUrl(url);
    const pinnedTab = this.pinnedTabsCache.get(normalizedUrl);
    const elapsed = performance.now() - startTime;

    Logger.info("Searching for pinned tab", {
      url,
      normalizedUrl,
      found: !!pinnedTab,
      cacheSize: this.pinnedTabsCache.size,
      elapsed: elapsed.toFixed(2) + "ms",
    });

    if (elapsed > 50) {
      Logger.warn(`Pinned tab check took ${elapsed.toFixed(2)}ms for ${url}`);
    }

    return pinnedTab || null;
  }

  /**
   * 指定されたタブIDがピン留めされているか判定
   * @param {number} tabId
   * @returns {Promise<boolean>}
   */
  async isPinned(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return tab.pinned;
    } catch (error) {
      Logger.error("Failed to check if tab is pinned", error);
      return false;
    }
  }

  /**
   * 内部URLかどうかを判定
   * @param {string} url
   * @returns {boolean}
   */
  isInternalUrl(url) {
    const internalSchemes = [
      "chrome:",
      "chrome-extension:",
      "about:",
      "edge:",
      "moz-extension:",
    ];
    return internalSchemes.some((scheme) => url.startsWith(scheme));
  }

  /**
   * URLを正規化（比較用）
   * @param {string} url
   * @returns {string}
   */
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);

      // プロトコルを統一（httpsに）
      let normalized = url.replace(/^http:/, "https:");

      // www.プレフィックスを削除
      normalized = normalized.replace(/^(https?:\/\/)www\./, "$1");

      // 末尾のスラッシュを削除（ルートパス以外）
      const tempUrl = new URL(normalized);
      if (tempUrl.pathname !== "/" && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
      }

      // ハッシュを削除
      const hashIndex = normalized.indexOf("#");
      if (hashIndex !== -1) {
        normalized = normalized.substring(0, hashIndex);
      }

      // クエリパラメータをソート（オプション：クエリパラメータの順序を統一）
      // 注意：クエリパラメータは残します（完全削除はしない）

      return normalized;
    } catch (error) {
      Logger.warn("Failed to normalize URL, using original", {
        url,
        error: error.message,
      });
      return url;
    }
  }

  /**
   * ピン留めタブ変更イベントのリスナーを設定
   */
  setupPinnedTabChangeListener() {
    // タブの更新イベントを監視（ピン留め状態の変更を検知）
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      // ピン留め状態が変更された場合
      if (changeInfo.pinned !== undefined) {
        Logger.info("Tab pinned state changed", {
          tabId,
          pinned: changeInfo.pinned,
          url: tab.url,
        });
        this.handlePinnedStateChange(tab);
      }
    });

    // タブが削除された場合
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      // キャッシュから該当するタブを削除
      for (const [url, tabInfo] of this.pinnedTabsCache.entries()) {
        if (tabInfo.id === tabId) {
          this.pinnedTabsCache.delete(url);
          Logger.info("Pinned tab removed from cache", { tabId, url });
          break;
        }
      }
    });

    // タブが作成された場合（ピン留めされたタブの場合）
    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.pinned && tab.url) {
        const normalizedUrl = this.normalizeUrl(tab.url);
        this.pinnedTabsCache.set(normalizedUrl, {
          id: tab.id,
          windowId: tab.windowId,
          url: tab.url,
          normalizedUrl: normalizedUrl,
          title: tab.title,
        });
        Logger.info("Pinned tab added to cache", {
          tabId: tab.id,
          url: tab.url,
          normalizedUrl: normalizedUrl,
        });
      }
    });
  }

  /**
   * ピン留め状態の変更を処理
   * @param {chrome.tabs.Tab} tab
   */
  handlePinnedStateChange(tab) {
    if (tab.pinned) {
      // ピン留めされた場合、キャッシュに追加
      if (tab.url) {
        const normalizedUrl = this.normalizeUrl(tab.url);
        this.pinnedTabsCache.set(normalizedUrl, {
          id: tab.id,
          windowId: tab.windowId,
          url: tab.url,
          normalizedUrl: normalizedUrl,
          title: tab.title,
        });
      }
    } else {
      // ピン留め解除された場合、キャッシュから削除
      if (tab.url) {
        const normalizedUrl = this.normalizeUrl(tab.url);
        this.pinnedTabsCache.delete(normalizedUrl);
      }
    }
  }

  /**
   * 全ウィンドウのピン留めタブを取得
   * @returns {Promise<Array<Object>>}
   */
  async getAllPinnedTabs() {
    try {
      const tabs = await chrome.tabs.query({ pinned: true });
      return tabs;
    } catch (error) {
      Logger.error("Failed to get all pinned tabs", error);
      return [];
    }
  }
}

// グローバルインスタンスを作成してエクスポート
const pinnedTabService = new PinnedTabService();

// グローバルスコープに公開（他のモジュールから参照可能に）
self.pinnedTabService = pinnedTabService;
