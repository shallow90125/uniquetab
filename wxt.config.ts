import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    action: { default_title: 'UniqueTab' },
    description: 'ピン留めされたタブと同一 URL のタブが複数開かれることを防ぐブラウザ拡張機能',
    name: 'UniqueTab',
    permissions: ['tabs', 'storage'],
  },
  modules: ['@wxt-dev/module-solid'],
  // in-source test を本番バンドルから除去（DCE）
  vite: () => ({ define: { 'import.meta.vitest': 'undefined' } }),
})
