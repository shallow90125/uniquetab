# 設計文書

## 概要

UniqueTab Chrome拡張機能は、Manifest V3仕様に基づいて開発され、Service Workerを使用してタブの重複を防ぐ機能を提供します。タブAPIを活用してピン留めタブの判定を行い、ピン留めタブへの遷移とタブの管理を実行します。

## アーキテクチャ

### 全体構成

```
Chrome拡張機能
├── Service Worker (background.js)
│   ├── タブイベント監視
│   ├── ピン留めタブ判定ロジック
│   └── タブ統合処理
├── Popup UI (popup.html/js)
│   └── 設定管理インターフェース
├── Options Page (options.html/js)
│   └── 詳細設定画面
└── Manifest (manifest.json)
    └── 権限とAPI宣言
```

### データフロー

1. ユーザーが新しいタブでURLを開く
2. Service Workerがタブ作成イベントを検知
3. 開かれたURLと同じURLのピン留めタブが存在するかチェック
4. ピン留めタブが見つかった場合、そのタブに遷移し新しいタブを削除
5. ピン留めタブが存在しない場合、通常通り新しいタブを維持

## コンポーネントとインターフェース

### Service Worker (background.js)

**主要機能:**
- タブイベントの監視（chrome.tabs.onCreated, chrome.tabs.onUpdated）
- ピン留めタブの検出と判定
- 重複タブの検出と統合処理

**主要メソッド:**
```javascript
class TabManager {
  async handleTabCreated(tab)
  async handleTabUpdated(tabId, changeInfo, tab)
  async findPinnedTab(url, excludeTabId)
  async switchToPinnedTab(pinnedTabId, newTabId)
  async getAllTabs()
}
```

### ピン留めタブ判定サービス

**主要機能:**
- ピン留めタブの検索
- URL完全一致判定
- ピン留め状態の監視

**主要メソッド:**
```javascript
class PinnedTabService {
  async findPinnedTabByUrl(url)
  async isPinned(tabId)
  setupPinnedTabChangeListener()
}
```

### 設定管理サービス

**主要機能:**
- 拡張機能のオン・オフ状態管理
- 設定の永続化（chrome.storage.sync）

**主要メソッド:**
```javascript
class SettingsService {
  async getSettings()
  async updateSettings(settings)
  async isEnabled()
}
```

### Popup UI

**主要機能:**
- 拡張機能の有効/無効切り替え
- 現在の状態表示

**インターフェース要素:**
- トグルスイッチ（有効/無効）
- 統計情報表示（統合されたタブ数など）

## データモデル

### 設定データ構造

```javascript
interface Settings {
  enabled: boolean;           // 拡張機能の有効/無効
  statistics: {
    mergedTabs: number;      // 統合されたタブの総数
    lastMergeTime: string;   // 最後に統合した時刻
  }
}
```

### タブ情報構造

```javascript
interface TabInfo {
  id: number;
  url: string;
  windowId: number;
  active: boolean;
  pinned: boolean;
  title: string;
}
```

## エラーハンドリング

### エラーケースと対応

1. **タブAPI呼び出し失敗（ピン留め判定）**
   - フォールバック: 通常のタブ動作を維持
   - ログ出力: コンソールに警告メッセージ

2. **タブAPI呼び出し失敗**
   - リトライ機構: 最大3回まで再試行
   - タイムアウト: 5秒でタイムアウト

3. **権限不足**
   - ユーザー通知: 権限が必要な旨を表示
   - グレースフルデグラデーション: 機能を無効化

4. **無効なURL**
   - バリデーション: URL形式チェック
   - スキップ: chrome://, moz-extension://等の内部URLは処理対象外

### ログ戦略

```javascript
class Logger {
  info(message, data)
  warn(message, data)
  error(message, error)
}
```

## テスト戦略

### 単体テスト

- **PinnedTabService**: ピン留めタブ判定ロジック
- **TabManager**: タブ統合ロジック
- **SettingsService**: 設定管理ロジック

### 統合テスト

- **タブ作成→統合フロー**: 実際のChrome環境でのE2Eテスト
- **設定変更反映**: 設定変更が即座に動作に反映されることを確認

### パフォーマンステスト

- **応答時間測定**: タブ作成から統合完了までの時間
- **メモリ使用量**: 長時間使用時のメモリリーク検証
- **CPU使用率**: バックグラウンド処理の負荷測定

### テスト環境

- Chrome拡張機能開発者モード
- Jest（単体テスト）
- Puppeteer（E2Eテスト）

## セキュリティ考慮事項

### 権限の最小化

- 必要最小限のAPI権限のみ要求
- ホスト権限は使用しない（activeTab権限で代替）

### データ保護

- ユーザーのブラウジング履歴は保存しない
- 設定データのみローカルストレージに保存
- 外部サーバーとの通信は行わない

## パフォーマンス最適化

### 効率的なピン留めタブ検索

- ピン留めタブリストのキャッシュ化
- タブ変更時のみキャッシュ更新

### タブ処理の最適化

- 不要なタブ情報取得の削減
- バッチ処理による API呼び出し最小化

### メモリ管理

- イベントリスナーの適切な登録/解除
- 不要なオブジェクト参照の削除