import { fakeBrowser } from 'wxt/testing'

// 各テスト前に fakeBrowser の状態（storage / tabs / windows 等）をリセットする
beforeEach(() => {
  fakeBrowser.reset()
})
