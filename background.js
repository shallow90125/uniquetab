/**
 * UniqueTab - Service Worker
 * ブックマークに登録されたサイトで同一URLのタブが複数開かれることを防ぐ
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

// サービスクラスをインポート（ES Modules構文を使用）
import "./services/SettingsService.js";
import "./services/BookmarkService.js";
import "./services/TabManager.js";

// グローバルインスタンス
let tabManager;

/**
 * サービスを初期化
 */
async function initializeServices() {
  try {
    Logger.info("Initializing services...");

    // 設定サービスを初期化
    await self.settingsService.initialize();

    // ブックマークサービスを初期化
    await self.bookmarkService.initialize();

    // タブマネージャーを初期化
    tabManager = new self.TabManager(
      self.bookmarkService,
      self.settingsService
    );

    Logger.info("All services initialized successfully");
  } catch (error) {
    Logger.error("Failed to initialize services", error);
  }
}

// Service Worker初期化
Logger.info("Service Worker starting...");
initializeServices();

/**
 * タブ作成イベントリスナー
 */
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!tabManager) {
    Logger.warn("TabManager not initialized yet");
    return;
  }

  await tabManager.handleTabCreated(tab);
});

/**
 * タブ更新イベントリスナー
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tabManager) {
    Logger.warn("TabManager not initialized yet");
    return;
  }

  await tabManager.handleTabUpdated(tabId, changeInfo, tab);
});

/**
 * 拡張機能インストール時の初期化
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  Logger.info("Extension installed/updated", { reason: details.reason });

  // サービスを初期化
  await initializeServices();
});
