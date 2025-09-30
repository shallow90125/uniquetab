/**
 * Popup UI Script
 * ポップアップインターフェースの動作を制御
 */

// DOM要素
const enableToggle = document.getElementById("enableToggle");
const mergedTabsCount = document.getElementById("mergedTabsCount");
const lastMergeTime = document.getElementById("lastMergeTime");
const resetStatsBtn = document.getElementById("resetStatsBtn");

/**
 * 設定を読み込んで表示
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(null);

    // 有効/無効状態を反映
    enableToggle.checked = settings.enabled !== false;

    // 統計情報を表示
    if (settings.statistics) {
      mergedTabsCount.textContent = settings.statistics.mergedTabs || 0;

      if (settings.statistics.lastMergeTime) {
        const date = new Date(settings.statistics.lastMergeTime);
        lastMergeTime.textContent = formatDateTime(date);
      } else {
        lastMergeTime.textContent = "-";
      }
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
}

/**
 * 日時をフォーマット
 * @param {Date} date
 * @returns {string}
 */
function formatDateTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return "たった今";
  } else if (diffMins < 60) {
    return `${diffMins}分前`;
  } else if (diffHours < 24) {
    return `${diffHours}時間前`;
  } else if (diffDays < 7) {
    return `${diffDays}日前`;
  } else {
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

/**
 * トグルスイッチの変更を処理
 */
enableToggle.addEventListener("change", async (event) => {
  const enabled = event.target.checked;

  try {
    await chrome.storage.sync.set({ enabled });
    console.log(`Extension ${enabled ? "enabled" : "disabled"}`);

    // 視覚的フィードバック
    enableToggle.disabled = true;
    setTimeout(() => {
      enableToggle.disabled = false;
    }, 300);
  } catch (error) {
    console.error("Failed to update settings:", error);
    // エラー時は元に戻す
    event.target.checked = !enabled;
  }
});

/**
 * 統計リセットボタンの処理
 */
resetStatsBtn.addEventListener("click", async () => {
  if (!confirm("統計情報をリセットしますか?")) {
    return;
  }

  try {
    const settings = await chrome.storage.sync.get(null);
    settings.statistics = {
      mergedTabs: 0,
      lastMergeTime: null,
    };
    await chrome.storage.sync.set(settings);

    // 表示を更新
    mergedTabsCount.textContent = "0";
    lastMergeTime.textContent = "-";

    console.log("Statistics reset");
  } catch (error) {
    console.error("Failed to reset statistics:", error);
    alert("統計情報のリセットに失敗しました");
  }
});

/**
 * Storage変更を監視して表示を更新
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync") {
    loadSettings();
  }
});

// 初期読み込み
loadSettings();
