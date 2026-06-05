/**
 * PinnedTabService のテスト
 */

const fs = require("fs");
const path = require("path");

// PinnedTabService のコードを読み込む
const pinnedTabServiceCode = fs.readFileSync(
  path.join(__dirname, "../services/PinnedTabService.js"),
  "utf8"
);

describe("PinnedTabService", () => {
  let PinnedTabService;
  let pinnedTabService;
  let Logger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Logger のモック
    Logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    global.Logger = Logger;

    // PinnedTabService クラスを評価
    eval(pinnedTabServiceCode);
    pinnedTabService = new PinnedTabService();
  });

  describe("initialize", () => {
    it("初回の初期化でキャッシュを構築する", async () => {
      const mockTabs = [
        {
          id: 1,
          url: "https://example.com",
          pinned: true,
          windowId: 1,
          title: "Example",
        },
        {
          id: 2,
          url: "https://test.com",
          pinned: false,
          windowId: 1,
          title: "Test",
        },
        {
          id: 3,
          url: "https://pinned.com",
          pinned: true,
          windowId: 1,
          title: "Pinned",
        },
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);

      await pinnedTabService.initialize();

      expect(pinnedTabService.cacheInitialized).toBe(true);
      expect(pinnedTabService.pinnedTabsCache.size).toBe(2);
      expect(pinnedTabService.pinnedTabsCache.has("https://example.com")).toBe(
        true
      );
      expect(pinnedTabService.pinnedTabsCache.has("https://pinned.com")).toBe(
        true
      );
      expect(pinnedTabService.pinnedTabsCache.has("https://test.com")).toBe(
        false
      );
    });

    it("既に初期化済みの場合は再初期化しない", async () => {
      pinnedTabService.cacheInitialized = true;

      await pinnedTabService.initialize();

      expect(chrome.tabs.query).not.toHaveBeenCalled();
    });
  });

  describe("findPinnedTabByUrl", () => {
    beforeEach(async () => {
      const mockTabs = [
        {
          id: 1,
          url: "https://example.com",
          pinned: true,
          windowId: 1,
          title: "Example",
        },
        {
          id: 2,
          url: "https://pinned.com",
          pinned: true,
          windowId: 2,
          title: "Pinned",
        },
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);
      await pinnedTabService.initialize();
    });

    it("ピン留めされたタブを見つける", async () => {
      const result = await pinnedTabService.findPinnedTabByUrl(
        "https://example.com"
      );

      expect(result).toEqual({
        id: 1,
        url: "https://example.com",
        windowId: 1,
        title: "Example",
      });
    });

    it("ピン留めされていないURLの場合はnullを返す", async () => {
      const result = await pinnedTabService.findPinnedTabByUrl(
        "https://notpinned.com"
      );

      expect(result).toBeNull();
    });

    it("内部URLの場合はnullを返す", async () => {
      const result = await pinnedTabService.findPinnedTabByUrl(
        "chrome://settings"
      );

      expect(result).toBeNull();
      expect(chrome.tabs.query).toHaveBeenCalledTimes(1); // initializeのみ
    });

    it("空のURLの場合はnullを返す", async () => {
      const result = await pinnedTabService.findPinnedTabByUrl("");

      expect(result).toBeNull();
    });

    it("50ms以上かかる場合は警告を出力", async () => {
      // パフォーマンスを低下させるため、大きなキャッシュをシミュレート
      const originalNow = performance.now;
      let callCount = 0;
      performance.now = jest.fn(() => {
        callCount++;
        return callCount === 1 ? 0 : 100; // 100msかかったことをシミュレート
      });

      await pinnedTabService.findPinnedTabByUrl("https://example.com");

      expect(Logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("Pinned tab check took"),
        expect.anything()
      );

      performance.now = originalNow;
    });
  });

  describe("isPinned", () => {
    it("ピン留めされているタブの場合はtrueを返す", async () => {
      chrome.tabs.get.mockResolvedValue({ id: 1, pinned: true });

      const result = await pinnedTabService.isPinned(1);

      expect(result).toBe(true);
      expect(chrome.tabs.get).toHaveBeenCalledWith(1);
    });

    it("ピン留めされていないタブの場合はfalseを返す", async () => {
      chrome.tabs.get.mockResolvedValue({ id: 2, pinned: false });

      const result = await pinnedTabService.isPinned(2);

      expect(result).toBe(false);
    });

    it("エラーが発生した場合はfalseを返す", async () => {
      chrome.tabs.get.mockRejectedValue(new Error("Tab not found"));

      const result = await pinnedTabService.isPinned(999);

      expect(result).toBe(false);
      expect(Logger.error).toHaveBeenCalled();
    });
  });

  describe("isInternalUrl", () => {
    it("chrome:// スキームはtrueを返す", () => {
      expect(pinnedTabService.isInternalUrl("chrome://settings")).toBe(true);
    });

    it("chrome-extension:// スキームはtrueを返す", () => {
      expect(
        pinnedTabService.isInternalUrl("chrome-extension://abcdef/popup.html")
      ).toBe(true);
    });

    it("about: スキームはtrueを返す", () => {
      expect(pinnedTabService.isInternalUrl("about:blank")).toBe(true);
    });

    it("通常のHTTP URLはfalseを返す", () => {
      expect(pinnedTabService.isInternalUrl("https://example.com")).toBe(false);
    });

    it("通常のHTTPS URLはfalseを返す", () => {
      expect(pinnedTabService.isInternalUrl("http://example.com")).toBe(false);
    });
  });

  describe("handlePinnedStateChange", () => {
    it("ピン留めされた場合はキャッシュに追加", () => {
      const tab = {
        id: 1,
        url: "https://example.com",
        pinned: true,
        windowId: 1,
        title: "Example",
      };

      pinnedTabService.handlePinnedStateChange(tab);

      expect(pinnedTabService.pinnedTabsCache.has("https://example.com")).toBe(
        true
      );
      expect(
        pinnedTabService.pinnedTabsCache.get("https://example.com")
      ).toEqual({
        id: 1,
        url: "https://example.com",
        windowId: 1,
        title: "Example",
      });
    });

    it("ピン留め解除された場合はキャッシュから削除", () => {
      pinnedTabService.pinnedTabsCache.set("https://example.com", {
        id: 1,
        url: "https://example.com",
        windowId: 1,
        title: "Example",
      });

      const tab = {
        id: 1,
        url: "https://example.com",
        pinned: false,
        windowId: 1,
        title: "Example",
      };

      pinnedTabService.handlePinnedStateChange(tab);

      expect(pinnedTabService.pinnedTabsCache.has("https://example.com")).toBe(
        false
      );
    });
  });

  describe("getAllPinnedTabs", () => {
    it("全てのピン留めタブを取得", async () => {
      const mockTabs = [
        { id: 1, url: "https://example.com", pinned: true },
        { id: 2, url: "https://pinned.com", pinned: true },
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await pinnedTabService.getAllPinnedTabs();

      expect(result).toEqual(mockTabs);
      expect(chrome.tabs.query).toHaveBeenCalledWith({ pinned: true });
    });

    it("エラーが発生した場合は空配列を返す", async () => {
      chrome.tabs.query.mockRejectedValue(new Error("API error"));

      const result = await pinnedTabService.getAllPinnedTabs();

      expect(result).toEqual([]);
      expect(Logger.error).toHaveBeenCalled();
    });
  });
});
