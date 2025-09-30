# Chrome Web Store パッケージングガイド

## 前提条件

拡張機能を Chrome Web Store に公開する前に、以下を完了してください:

1. すべての機能テストが完了
2. アイコンファイルが準備されている
3. Chrome Developer アカウントが作成されている

## アイコンの準備

以下のサイズのアイコンを `icons/` ディレクトリに配置してください:

- `icon16.png` - 16x16px (ツールバーアイコン)
- `icon48.png` - 48x48px (拡張機能管理ページ)
- `icon128.png` - 128x128px (Chrome Web Store)

アイコンのデザイン要件:

- PNG 形式
- 透明背景推奨
- UniqueTab のロゴまたはタブを表現するデザイン
- シンプルで視認性の高いデザイン

## パッケージの作成

### 1. ファイルの確認

以下のファイルが含まれていることを確認:

```
uniquetab/
├── manifest.json
├── background.js
├── popup.html
├── popup.css
├── popup.js
├── services/
│   ├── BookmarkService.js
│   ├── SettingsService.js
│   └── TabManager.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

### 2. 不要なファイルの除外

以下のファイル/ディレクトリは **含めない** でください:

- `.git/`
- `.kiro/`
- `node_modules/`
- `tests/`
- `package.json`
- `package-lock.json`
- その他開発用ファイル

### 3. ZIP ファイルの作成

#### macOS の場合:

```bash
# プロジェクトディレクトリで実行
zip -r uniquetab-1.0.0.zip manifest.json background.js popup.html popup.css popup.js services/ icons/ README.md -x "*.DS_Store"
```

#### Windows の場合:

1. 必要なファイルとフォルダを選択
2. 右クリック → 「送る」→ 「圧縮(zip 形式)フォルダー」
3. `uniquetab-1.0.0.zip` という名前に変更

## Chrome Web Store への公開

### 1. Developer Dashboard へアクセス

https://chrome.google.com/webstore/devconsole

### 2. 新しいアイテムの追加

1. 「新しいアイテム」ボタンをクリック
2. 作成した ZIP ファイルをアップロード
3. アイテムの詳細情報を入力

### 3. ストアリスティング情報

以下の情報を入力:

**詳細な説明:**

```
UniqueTabは、ブックマークに登録されたサイトで同一URLのタブが複数開かれることを防ぐChrome拡張機能です。

【主な機能】
• ブックマークに登録されたURLで重複タブを自動的に統合
• 既存のタブに自動遷移し、新しいタブを削除
• ワンクリックで機能のオン・オフ切り替え
• 統合されたタブ数の統計情報を表示

【使い方】
1. 拡張機能をインストール
2. よく使うサイトをブックマークに登録
3. 同じURLを複数回開こうとすると、自動的に既存のタブに遷移

タブバーを整理し、作業効率を向上させましょう！
```

**カテゴリ:** 生産性向上

**言語:** 日本語

**スクリーンショット:**

- ポップアップ UI のスクリーンショット
- タブ統合の動作デモ
- 統計情報の表示

### 4. プライバシー設定

プライバシーポリシー URL: (必要に応じて作成)

**データの取り扱い:**

- ユーザーデータは収集しません
- ブックマークとタブ情報はローカルでのみ処理
- 外部サーバーへのデータ送信なし

### 5. 公開設定

- **公開範囲:** 一般公開
- **地域:** すべての地域（または日本のみ）
- **価格:** 無料

### 6. 審査の提出

すべての情報を入力後、「公開用に提出」ボタンをクリックします。

審査には通常 1〜3 営業日かかります。

## ローカルテスト（公開前）

### Chrome 拡張機能の読み込み

1. `chrome://extensions/` を開く
2. 「デベロッパーモード」を有効化
3. 「パッケージ化されていない拡張機能を読み込む」をクリック
4. プロジェクトのルートディレクトリを選択

### 動作確認チェックリスト

- [ ] タブ統合機能が正常に動作
- [ ] ポップアップ UI が正しく表示
- [ ] 設定の保存と読み込みが正常
- [ ] ブックマーク判定が正確
- [ ] 統計情報が正しく更新
- [ ] エラーが発生しない
- [ ] パフォーマンスが良好（100ms 以内）

## バージョン管理

### バージョン番号の更新

新しいバージョンをリリースする際は、以下のファイルのバージョン番号を更新:

1. `manifest.json` の `version`
2. `popup.html` の `Version` 表記
3. README.md の情報

### 変更履歴の記録

CHANGELOG.md を作成して変更内容を記録することを推奨します。

## トラブルシューティング

### よくある問題

**問題:** アップロードエラー
**解決:** manifest.json の構文を確認

**問題:** アイコンが表示されない
**解決:** アイコンファイルのパスとサイズを確認

**問題:** 権限エラー
**解決:** manifest.json の permissions を確認

## サポート

問題が発生した場合は、Chrome Web Store Developer Support に問い合わせてください:
https://support.google.com/chrome_webstore/

## 参考リンク

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Web Store Developer Documentation](https://developer.chrome.com/docs/webstore/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
