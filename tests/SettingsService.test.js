/**
 * SettingsService のテスト
 */

const fs = require("fs");
const path = require("path");

// SettingsService のコードを読み込む
const settingsServiceCode = fs.readFileSync(
  path.join(__dirname, "../services/SettingsService.js"),
  "utf8"
);

describe("SettingsService", () => {
  let SettingsService;
  let settingsService;
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

    // SettingsService クラスを評価（グローバル宣言を除去）
    const code = settingsServiceCode.replace(
      /const settingsService = new SettingsService\(\);[\s\S]*$/,
      ""
    );
    eval(code);
    settingsService = new SettingsService();
  });

  describe("initialize", () => {
    it("設定が存在しない場合はデフォルト設定で初期化", async () => {
      chrome.storage.sync.get.mockResolvedValue({});
      chrome.storage.sync.set.mockResolvedValue({});

      await settingsService.initialize();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        settingsService.defaultSettings
      );
      expect(Logger.info).toHaveBeenCalledWith(
        "Settings initialized with defaults"
      );
    });

    it("設定が既に存在する場合はロードのみ", async () => {
      const existingSettings = {
        enabled: true,
        statistics: { mergedTabs: 5, lastMergeTime: "2025-01-01" },
      };
      chrome.storage.sync.get.mockResolvedValue(existingSettings);

      await settingsService.initialize();

      expect(chrome.storage.sync.set).not.toHaveBeenCalled();
      expect(settingsService.cachedSettings).toEqual(existingSettings);
    });
  });

  describe("getSettings", () => {
    it("キャッシュがある場合はキャッシュを返す", async () => {
      const cachedSettings = { enabled: true };
      settingsService.cachedSettings = cachedSettings;

      const result = await settingsService.getSettings();

      expect(result).toEqual(cachedSettings);
      expect(chrome.storage.sync.get).not.toHaveBeenCalled();
    });

    it("キャッシュがない場合はストレージから取得", async () => {
      settingsService.cachedSettings = null;
      const storedSettings = { enabled: false };
      chrome.storage.sync.get.mockResolvedValue(storedSettings);

      const result = await settingsService.getSettings();

      expect(result).toEqual(storedSettings);
      expect(chrome.storage.sync.get).toHaveBeenCalled();
    });

    it("取得失敗時はデフォルト設定を返す", async () => {
      settingsService.cachedSettings = null;
      chrome.storage.sync.get.mockRejectedValue(new Error("Storage error"));

      const result = await settingsService.getSettings();

      expect(result).toEqual(settingsService.defaultSettings);
    });
  });

  describe("isEnabled", () => {
    it("有効の場合はtrueを返す", async () => {
      chrome.storage.sync.get.mockResolvedValue({ enabled: true });

      const result = await settingsService.isEnabled();

      expect(result).toBe(true);
    });

    it("無効の場合はfalseを返す", async () => {
      chrome.storage.sync.get.mockResolvedValue({ enabled: false });

      const result = await settingsService.isEnabled();

      expect(result).toBe(false);
    });

    it("設定がない場合はtrueを返す（デフォルト）", async () => {
      chrome.storage.sync.get.mockResolvedValue({});

      const result = await settingsService.isEnabled();

      expect(result).toBe(true);
    });
  });

  describe("updateSettings", () => {
    it("設定を部分更新する", async () => {
      const currentSettings = { enabled: true, statistics: { mergedTabs: 0 } };
      chrome.storage.sync.get.mockResolvedValue(currentSettings);
      chrome.storage.sync.set.mockResolvedValue({});

      await settingsService.updateSettings({ enabled: false });

      expect(chrome.storage.sync.set).toHaveBeenCalledWith({
        enabled: false,
        statistics: { mergedTabs: 0 },
      });
    });
  });

  describe("incrementMergedTabs", () => {
    it("統合されたタブ数をインクリメント", async () => {
      const currentSettings = {
        statistics: { mergedTabs: 5, lastMergeTime: null },
      };
      chrome.storage.sync.get.mockResolvedValue(currentSettings);
      chrome.storage.sync.set.mockResolvedValue({});

      await settingsService.incrementMergedTabs();

      expect(chrome.storage.sync.set).toHaveBeenCalled();
      const setCall = chrome.storage.sync.set.mock.calls[0][0];
      expect(setCall.statistics.mergedTabs).toBe(6);
      expect(setCall.statistics.lastMergeTime).toBeTruthy();
    });
  });

  describe("resetStatistics", () => {
    it("統計情報をリセット", async () => {
      chrome.storage.sync.get.mockResolvedValue({
        enabled: true,
        statistics: { mergedTabs: 10, lastMergeTime: "2025-01-01" },
      });
      chrome.storage.sync.set.mockResolvedValue({});

      await settingsService.resetStatistics();

      expect(chrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          statistics: settingsService.defaultSettings.statistics,
        })
      );
    });
  });
});
