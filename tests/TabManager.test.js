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
  let mockPinnedTabService;
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

    // PinnedTabService のモック
    mockPinnedTabService = {
      findPinnedTabByUrl: jest.fn(),
      initialize: jest.fn().mockResolvedValue(),
    };

    // self.pinnedTabService をモック
    global.self = {
      pinnedTabService: mockPinnedTabService,
    };

    // SettingsService のモック
    mockSettingsService = {
      isEnabled: jest.fn(),
      incrementMergedTabs: jest.fn(),
    };

    // TabManager クラスを評価
    eval(tabManagerCode);
    tabManager = new TabManager(mockSettingsService);
  });

  describe("findPinnedTab", () => {
    it("同じURLを持つピン留めタブを見つける", async () => {
      const mockPinnedTab = { id: 1, url: "https://example.com", windowId: 1 };
      mockPinnedTabService.findPinnedTabByUrl.mockResolvedValue(mockPinnedTab);

      const result = await tabManager.findPinnedTab("https://example.com", 3);

      expect(result).toEqual(mockPinnedTab);
      expect(mockPinnedTabService.findPinnedTabByUrl).toHaveBeenCalledWith(
        "https://example.com"
      );
    });

    it("ピン留めタブが見つからない場合はnullを返す", async () => {
      mockPinnedTabService.findPinnedTabByUrl.mockResolvedValue(null);

      const result = await tabManager.findPinnedTab("https://notfound.com", 3);

      expect(result).toBeNull();
    });

    it("自分自身のタブは除外する", async () => {
      const mockPinnedTab = { id: 1, url: "https://example.com", windowId: 1 };
      mockPinnedTabService.findPinnedTabByUrl.mockResolvedValue(mockPinnedTab);

      const result = await tabManager.findPinnedTab("https://example.com", 1);

      expect(result).toBeNull();
    });
  });

  describe("processTabUrl", () => {
    it("拡張機能が無効の場合は処理をスキップ", async () => {
      mockSettingsService.isEnabled.mockResolvedValue(false);

      await tabManager.processTabUrl(1, "https://example.com");

      expect(mockPinnedTabService.findPinnedTabByUrl).not.toHaveBeenCalled();
    });

    it("ピン留めタブが存在しない場合は処理をスキップ", async () => {
      mockSettingsService.isEnabled.mockResolvedValue(true);
      mockPinnedTabService.findPinnedTabByUrl.mockResolvedValue(null);

      await tabManager.processTabUrl(1, "https://example.com");

      expect(chrome.tabs.update).not.toHaveBeenCalled();
    });

    it("ピン留めタブが存在する場合はタブを統合する", async () => {
      mockSettingsService.isEnabled.mockResolvedValue(true);
      const mockPinnedTab = { id: 2, url: "https://example.com", windowId: 1 };
      mockPinnedTabService.findPinnedTabByUrl.mockResolvedValue(mockPinnedTab);

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
      mockPinnedTabService.findPinnedTabByUrl.mockResolvedValue(null);

      await tabManager.handleTabCreated({ id: 1, url: "https://example.com" });

      expect(mockPinnedTabService.findPinnedTabByUrl).toHaveBeenCalledWith(
        "https://example.com"
      );
    });
  });
});
