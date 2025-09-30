# UniqueTab アイコン

このディレクトリには、Chrome 拡張機能のアイコンファイルを配置します。

## 必要なファイル

以下の 3 つのサイズの PNG 画像が必要です:

1. **icon16.png** (16×16 ピクセル)

   - ブラウザのツールバーに表示されるアイコン
   - シンプルで視認性の高いデザイン

2. **icon48.png** (48×48 ピクセル)

   - 拡張機能管理ページ (chrome://extensions/) に表示
   - より詳細なデザインが可能

3. **icon128.png** (128×128 ピクセル)
   - Chrome Web Store に表示される主要アイコン
   - 最も詳細で高品質なデザイン

## デザインガイドライン

- **テーマ**: タブの重複防止を表現
  - 例: 重なったタブ、統合されるタブ、チェックマーク付きタブ
- **色**: 青系統（Chrome 拡張機能の標準色）を推奨
  - プライマリ: #1a73e8 (Google Blue)
  - セカンダリ: #5f6368 (Gray)
- **背景**: 透明推奨（PNG alpha channel 使用）
- **スタイル**: フラットデザイン、マテリアルデザイン準拠

## 作成方法

### オプション 1: デザインツールで作成

- Figma、Sketch、Adobe XD、Illustrator などを使用
- 128×128px でデザインを作成後、16px、48px にリサイズ
- PNG 形式でエクスポート

### オプション 2: オンラインツールを使用

- [Favicon Generator](https://favicon.io/)
- [Real Favicon Generator](https://realfavicongenerator.net/)

### オプション 3: プレースホルダーを使用（開発用）

開発中は以下のコマンドで簡単なプレースホルダーを作成できます:

```bash
# ImageMagickを使用（macOSの場合: brew install imagemagick）

# 16x16
convert -size 16x16 xc:#1a73e8 -pointsize 10 -fill white -gravity center -annotate +0+0 "UT" icon16.png

# 48x48
convert -size 48x48 xc:#1a73e8 -pointsize 30 -fill white -gravity center -annotate +0+0 "UT" icon48.png

# 128x128
convert -size 128x128 xc:#1a73e8 -pointsize 80 -fill white -gravity center -annotate +0+0 "UT" icon128.png
```

## アイコンの確認

アイコンを配置後、以下の方法で確認できます:

1. `chrome://extensions/` で拡張機能を読み込む
2. ツールバー、拡張機能リスト、ポップアップで表示を確認
3. 各サイズで視認性が良好か確認

## 参考リンク

- [Chrome Extension Icon Guidelines](https://developer.chrome.com/docs/extensions/mv3/manifest/icons/)
- [Material Design Icons](https://fonts.google.com/icons)
