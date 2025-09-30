/**
 * SettingsService
 * 拡張機能の設定管理を行うサービスクラス
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

class SettingsService {
  constructor() {
    this.defaultSettings = {
      enabled: true,
      statistics: {
        mergedTabs: 0,
        lastMergeTime: null,
      },
    };
    this.cachedSettings = null;
    this.settingsListeners = [];
  }

  /**
   * 初期化: デフォルト設定を保存
   */
  async initialize() {
    try {
      const settings = await this.getSettings();
      if (!settings || settings.enabled === undefined) {
        await this.saveSettings(this.defaultSettings);
        Logger.info("Settings initialized with defaults");
      } else {
        this.cachedSettings = settings;
        Logger.info("Settings loaded", settings);
      }
    } catch (error) {
      Logger.error("Failed to initialize settings", error);
      throw error;
    }
  }

  /**
   * 設定を取得
   * @returns {Promise<Object>}
   */
  async getSettings() {
    try {
      // キャッシュがある場合はキャッシュを返す
      if (this.cachedSettings) {
        return this.cachedSettings;
      }

      const result = await chrome.storage.sync.get(null);
      this.cachedSettings = result;
      return result;
    } catch (error) {
      Logger.error("Failed to get settings", error);
      return this.defaultSettings;
    }
  }

  /**
   * 設定を保存
   * @param {Object} settings
   */
  async saveSettings(settings) {
    try {
      await chrome.storage.sync.set(settings);
      this.cachedSettings = settings;
      Logger.info("Settings saved", settings);

      // リスナーに通知
      this.notifySettingsChanged(settings);
    } catch (error) {
      Logger.error("Failed to save settings", error);
      throw error;
    }
  }

  /**
   * 設定を更新
   * @param {Object} updates - 更新する設定の部分オブジェクト
   */
  async updateSettings(updates) {
    try {
      const currentSettings = await this.getSettings();
      const newSettings = { ...currentSettings, ...updates };
      await this.saveSettings(newSettings);
    } catch (error) {
      Logger.error("Failed to update settings", error);
      throw error;
    }
  }

  /**
   * 拡張機能が有効かどうかを取得
   * @returns {Promise<boolean>}
   */
  async isEnabled() {
    try {
      const settings = await this.getSettings();
      return settings.enabled !== false; // デフォルトはtrue
    } catch (error) {
      Logger.error("Failed to check if enabled", error);
      return true; // エラー時はデフォルトで有効
    }
  }

  /**
   * 拡張機能の有効/無効を設定
   * @param {boolean} enabled
   */
  async setEnabled(enabled) {
    try {
      await this.updateSettings({ enabled });
      Logger.info(`Extension ${enabled ? "enabled" : "disabled"}`);
    } catch (error) {
      Logger.error("Failed to set enabled state", error);
      throw error;
    }
  }

  /**
   * 統計情報を取得
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    try {
      const settings = await this.getSettings();
      return settings.statistics || this.defaultSettings.statistics;
    } catch (error) {
      Logger.error("Failed to get statistics", error);
      return this.defaultSettings.statistics;
    }
  }

  /**
   * 統合されたタブ数をインクリメント
   */
  async incrementMergedTabs() {
    try {
      const statistics = await this.getStatistics();
      const newStatistics = {
        mergedTabs: (statistics.mergedTabs || 0) + 1,
        lastMergeTime: new Date().toISOString(),
      };
      await this.updateSettings({ statistics: newStatistics });
      Logger.info("Statistics updated", newStatistics);
    } catch (error) {
      Logger.error("Failed to increment merged tabs", error);
    }
  }

  /**
   * 統計情報をリセット
   */
  async resetStatistics() {
    try {
      await this.updateSettings({
        statistics: this.defaultSettings.statistics,
      });
      Logger.info("Statistics reset");
    } catch (error) {
      Logger.error("Failed to reset statistics", error);
      throw error;
    }
  }

  /**
   * 設定変更リスナーを追加
   * @param {Function} listener
   */
  addSettingsListener(listener) {
    this.settingsListeners.push(listener);
  }

  /**
   * 設定変更リスナーを削除
   * @param {Function} listener
   */
  removeSettingsListener(listener) {
    const index = this.settingsListeners.indexOf(listener);
    if (index > -1) {
      this.settingsListeners.splice(index, 1);
    }
  }

  /**
   * 設定変更を通知
   * @param {Object} settings
   */
  notifySettingsChanged(settings) {
    for (const listener of this.settingsListeners) {
      try {
        listener(settings);
      } catch (error) {
        Logger.error("Error in settings listener", error);
      }
    }
  }

  /**
   * Chrome storage変更イベントを監視
   */
  setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "sync") {
        Logger.info("Storage changed", changes);
        // キャッシュをクリア
        this.cachedSettings = null;
        // 新しい設定を取得して通知
        this.getSettings().then((settings) => {
          this.notifySettingsChanged(settings);
        });
      }
    });
  }
}

// グローバルインスタンスを作成してエクスポート
const settingsService = new SettingsService();
settingsService.setupStorageListener();

// グローバルスコープに公開（他のモジュールから参照可能に）
self.settingsService = settingsService;
