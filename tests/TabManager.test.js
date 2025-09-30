/**
 * TabManager のテスト
 */

const fs = require("fs");
const path = require("path");

// TabManager のコードを読み込む
const tabManagerCode = fs.readFileSync(
  path.join(__dirname, "../services/TabManager.js"),
  "utf8"
);

describe("TabManager", () => {
  let TabManager;
  let tabManager;
  let mockBookmarkService;
  let mockSettingsService;
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

    // BookmarkService のモック
    mockBookmarkService = {
      isUrlBookmarked: jest.fn(),
    };

    // SettingsService のモック
    mockSettingsService = {
      isEnabled: jest.fn(),
      incrementMergedTabs: jest.fn(),
    };

    // TabManager クラスを評価
    eval(tabManagerCode);
    tabManager = new TabManager(mockBookmarkService, mockSettingsService);
  });

  describe("findExistingTab", () => {
    it("同じURLを持つ既存タブを見つける", async () => {
      const mockTabs = [
        { id: 1, url: "https://example.com" },
        { id: 2, url: "https://test.com" },
        { id: 3, url: "https://example.com" },
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await tabManager.findExistingTab("https://example.com", 3);

      expect(result).toEqual({ id: 1, url: "https://example.com" });
    });

    it("既存タブが見つからない場合はnullを返す", async () => {
      const mockTabs = [
        { id: 1, url: "https://example.com" },
        { id: 2, url: "https://test.com" },
      ];
      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await tabManager.findExistingTab(
        "https://notfound.com",
        3
      );

      expect(result).toBeNull();
    });

    it("自分自身のタブは除外する", async () => {
      const mockTabs = [{ id: 1, url: "https://example.com" }];
      chrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await tabManager.findExistingTab("https://example.com", 1);

      expect(result).toBeNull();
    });
  });

  describe("processTabUrl", () => {
    it("拡張機能が無効の場合は処理をスキップ", async () => {
      mockSettingsService.isEnabled.mockResolvedValue(false);

      await tabManager.processTabUrl(1, "https://example.com");

      expect(mockBookmarkService.isUrlBookmarked).not.toHaveBeenCalled();
    });

    it("ブックマークされていないURLは処理をスキップ", async () => {
      mockSettingsService.isEnabled.mockResolvedValue(true);
      mockBookmarkService.isUrlBookmarked.mockResolvedValue(false);

      await tabManager.processTabUrl(1, "https://example.com");

      expect(chrome.tabs.query).not.toHaveBeenCalled();
    });

    it("既存タブが存在する場合はタブを統合する", async () => {
      mockSettingsService.isEnabled.mockResolvedValue(true);
      mockBookmarkService.isUrlBookmarked.mockResolvedValue(true);

      const mockTabs = [{ id: 2, url: "https://example.com", windowId: 1 }];
      chrome.tabs.query.mockResolvedValue(mockTabs);
      chrome.tabs.get.mockResolvedValue({ id: 2, windowId: 1 });
      chrome.tabs.update.mockResolvedValue({});
      chrome.windows.update.mockResolvedValue({});
      chrome.tabs.remove.mockResolvedValue({});

      await tabManager.processTabUrl(1, "https://example.com");

      expect(chrome.tabs.update).toHaveBeenCalledWith(2, { active: true });
      expect(chrome.tabs.remove).toHaveBeenCalledWith(1);
      expect(mockSettingsService.incrementMergedTabs).toHaveBeenCalled();
    });

    it("処理中のタブは重複処理しない", async () => {
      tabManager.processingTabs.add(1);

      await tabManager.processTabUrl(1, "https://example.com");

      expect(mockSettingsService.isEnabled).not.toHaveBeenCalled();
      expect(Logger.info).toHaveBeenCalledWith(
        "Tab already being processed, skipping",
        { tabId: 1 }
      );
    });
  });

  describe("switchToTab", () => {
    it("タブをアクティブにしてウィンドウを前面に表示", async () => {
      chrome.tabs.get.mockResolvedValue({ id: 1, windowId: 10 });
      chrome.tabs.update.mockResolvedValue({});
      chrome.windows.update.mockResolvedValue({});

      await tabManager.switchToTab(1);

      expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
      expect(chrome.windows.update).toHaveBeenCalledWith(10, { focused: true });
    });
  });

  describe("removeTab", () => {
    it("タブを削除する", async () => {
      chrome.tabs.remove.mockResolvedValue({});

      await tabManager.removeTab(1);

      expect(chrome.tabs.remove).toHaveBeenCalledWith(1);
      expect(Logger.info).toHaveBeenCalledWith("Tab removed", { tabId: 1 });
    });

    it("既に閉じられているタブの削除エラーは無視", async () => {
      chrome.tabs.remove.mockRejectedValue(new Error("No tab with id: 1"));

      await tabManager.removeTab(1);

      expect(Logger.warn).toHaveBeenCalledWith("Tab already closed", {
        tabId: 1,
      });
    });
  });

  describe("handleTabCreated", () => {
    it("URLが設定されていないタブはスキップ", async () => {
      await tabManager.handleTabCreated({ id: 1, url: "" });
      await tabManager.handleTabCreated({ id: 2, url: "chrome://newtab/" });
      await tabManager.handleTabCreated({ id: 3, url: "about:blank" });

      expect(mockSettingsService.isEnabled).not.toHaveBeenCalled();
    });

    it("有効なURLの場合は処理を実行", async () => {
      mockSettingsService.isEnabled.mockResolvedValue(true);
      mockBookmarkService.isUrlBookmarked.mockResolvedValue(false);

      await tabManager.handleTabCreated({ id: 1, url: "https://example.com" });

      expect(mockBookmarkService.isUrlBookmarked).toHaveBeenCalledWith(
        "https://example.com"
      );
    });
  });
});
