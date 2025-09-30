/**
 * BookmarkService
 * ブックマークの検索と判定を行うサービスクラス
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

class BookmarkService {
  constructor() {
    this.bookmarkCache = new Map(); // URLをキーとしたブックマークキャッシュ
    this.cacheInitialized = false;
    this.setupBookmarkChangeListener();
  }

  /**
   * 初期化: ブックマークキャッシュを構築
   */
  async initialize() {
    if (this.cacheInitialized) {
      return;
    }

    try {
      await this.refreshCache();
      this.cacheInitialized = true;
      Logger.info("BookmarkService initialized");
    } catch (error) {
      Logger.error("Failed to initialize BookmarkService", error);
    }
  }

  /**
   * ブックマークキャッシュを更新
   */
  async refreshCache() {
    try {
      const startTime = performance.now();
      this.bookmarkCache.clear();

      const tree = await chrome.bookmarks.getTree();
      this.traverseBookmarkTree(tree);

      const elapsed = performance.now() - startTime;
      Logger.info(`Bookmark cache refreshed in ${elapsed.toFixed(2)}ms`, {
        count: this.bookmarkCache.size,
      });
    } catch (error) {
      Logger.error("Failed to refresh bookmark cache", error);
      throw error;
    }
  }

  /**
   * ブックマークツリーを再帰的に走査してキャッシュに追加
   */
  traverseBookmarkTree(nodes) {
    if (!nodes || !Array.isArray(nodes)) {
      return;
    }

    for (const node of nodes) {
      // URLが存在する場合はキャッシュに追加
      if (node.url) {
        this.bookmarkCache.set(node.url, {
          id: node.id,
          title: node.title,
          url: node.url,
        });
      }

      // 子ノードがある場合は再帰的に処理
      if (node.children) {
        this.traverseBookmarkTree(node.children);
      }
    }
  }

  /**
   * 指定されたURLがブックマークに登録されているか判定
   * @param {string} url - 判定対象のURL
   * @returns {Promise<boolean>} ブックマークに登録されている場合はtrue
   */
  async isUrlBookmarked(url) {
    if (!url) {
      return false;
    }

    // chrome:// や about: などの内部URLは対象外
    if (this.isInternalUrl(url)) {
      return false;
    }

    // キャッシュが初期化されていない場合は初期化
    if (!this.cacheInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    const isBookmarked = this.bookmarkCache.has(url);
    const elapsed = performance.now() - startTime;

    if (elapsed > 50) {
      Logger.warn(`Bookmark check took ${elapsed.toFixed(2)}ms for ${url}`);
    }

    return isBookmarked;
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
   * ブックマーク変更イベントのリスナーを設定
   */
  setupBookmarkChangeListener() {
    // ブックマーク作成時
    chrome.bookmarks.onCreated.addListener((id, bookmark) => {
      Logger.info("Bookmark created", { id, url: bookmark.url });
      if (bookmark.url) {
        this.bookmarkCache.set(bookmark.url, {
          id: bookmark.id,
          title: bookmark.title,
          url: bookmark.url,
        });
      }
    });

    // ブックマーク削除時
    chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
      Logger.info("Bookmark removed", { id });
      // URLが分からないため、キャッシュ全体を再構築
      this.refreshCache().catch((error) => {
        Logger.error("Failed to refresh cache on bookmark removal", error);
      });
    });

    // ブックマーク変更時
    chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
      Logger.info("Bookmark changed", { id, changeInfo });
      // キャッシュを再構築（URLが変更された可能性があるため）
      this.refreshCache().catch((error) => {
        Logger.error("Failed to refresh cache on bookmark change", error);
      });
    });

    // ブックマーク移動時
    chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
      Logger.info("Bookmark moved", { id });
      // 移動してもURLは変わらないため、キャッシュ更新は不要
    });
  }

  /**
   * 指定されたURLのブックマーク情報を取得
   * @param {string} url
   * @returns {Promise<Object|null>}
   */
  async getBookmarkInfo(url) {
    if (!this.cacheInitialized) {
      await this.initialize();
    }
    return this.bookmarkCache.get(url) || null;
  }
}

// グローバルインスタンスを作成してエクスポート
const bookmarkService = new BookmarkService();

// グローバルスコープに公開（他のモジュールから参照可能に）
self.bookmarkService = bookmarkService;
