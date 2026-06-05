# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

UniqueTab は、ピン留め (またはブックマーク) されたサイトと同一 URL のタブが複数開かれることを防ぐブラウザ拡張機能。新しく開かれた重複タブを閉じ、既存のタブにフォーカスを移す。

このディレクトリ (`v2`) は **WXT + SolidJS による作り直し版**。機能ロジックは未移植で、現状は WXT-Solid スターターテンプレートの状態。プロダクト仕様とリファレンス実装は `v1/` (旧 Vanilla JS / Manifest V3 版) にある。

## コマンド

パッケージマネージャは **Bun** (`bun.lock`)。`bunfig.toml` で依存は公開から 7 日経過したものだけインストールされる設定。

- `bun run dev` — 開発サーバ (Chrome)。`bun run dev:firefox` で Firefox
- `bun run build` — 本番ビルド。`bun run build:firefox` で Firefox
- `bun run zip` — 配布用 zip 生成 (`zip:firefox` あり)
- `bun run compile` — `tsc --noEmit` による型チェック
- `bun run lint` / `bun run lint:fix` — oxlint
- `bun run fmt` / `bun run fmt:check` — oxfmt
- `bun run test` — vitest (一括実行)。単一テストは `bunx vitest run <path>`、ウォッチは `bunx vitest`

コミット時は husky + lint-staged が `lint:fix` と `fmt` を自動実行する。

## アーキテクチャ

### v2 (WXT + SolidJS)

WXT のファイルベース規約に従う。`entrypoints/` 配下が各実行コンテキストのエントリ:

- `entrypoints/background.ts` — `defineBackground()`。Service Worker。タブ監視・重複判定の中核ロジックがここに入る予定
- `entrypoints/content.ts` — `defineContentScript()`。`matches` で対象 URL を指定
- `entrypoints/popup/` — SolidJS 製のポップアップ UI (`main.tsx` がエントリ、`App.tsx` が本体)

WXT が `browser` グローバル・型・manifest を自動生成するため、`browser.runtime` 等は import 不要で使える。manifest は `wxt.config.ts` と各 entrypoint の定義から生成される (手書きの manifest.json は無い)。静的アセットは `public/`、バンドル対象アセットは `assets/`。

### v1 (リファレンス実装 / 旧版)

`v1/` は Manifest V3 + Vanilla JS の完成済み実装。lint/fmt の対象外 (`ignorePatterns`)。サービス層アーキテクチャを採用:

- `services/TabManager.js` — タブ管理・統合の統合サービス。`processingTabs` で処理中タブの二重処理を防止、リトライ機構あり
- `services/PinnedTabService.js` — ピン留めタブ判定 (キャッシュ機構付き)
- `services/BookmarkService.js` — ブックマーク URL 判定
- `services/SettingsService.js` — `chrome.storage.sync` による設定永続化・統計

v2 で機能を実装する際は、これらの判定ロジック・パフォーマンス要件 (タブ統合 < 100ms 等) を踏襲する。仕様の詳細は `v1/.kiro/specs/unique-tab-extension/` (requirements / design / tasks) を参照。

## コードスタイル

oxlint + oxfmt で統一。`.oxfmtrc.json`: タブインデント / シングルクォート / セミコロン無し / trailing comma all。`.oxlintrc.json`: correctness カテゴリを error、`sort-imports` / `sort-keys` / `sort-vars` を強制 (import・オブジェクトキー・変数宣言はアルファベット順)。型認識リント (typeAware / typeCheck) 有効。

TypeScript の JSX は SolidJS 用 (`jsxImportSource: "solid-js"`、`jsx: "preserve"`)。
