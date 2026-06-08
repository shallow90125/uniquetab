import { storage } from 'wxt/utils/storage'

/**
 * 拡張機能の有効・無効フラグ。
 *
 * v1 の `chrome.storage.sync` の `enabled` キーと同一なのでデータが引き継がれる。
 * `fallback: true` により未設定時はデフォルトで有効。
 */
export const enabledItem = storage.defineItem<boolean>('sync:enabled', {
  fallback: true,
})

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  describe('enabledItem', () => {
    it('未設定時は fallback の true を返す', async () => {
      expect(await enabledItem.getValue()).toBe(true)
    })

    it('値を往復できる', async () => {
      await enabledItem.setValue(false)
      expect(await enabledItem.getValue()).toBe(false)
    })

    it('watch で変更を通知する', async () => {
      let observed: boolean | null = null
      const unwatch = enabledItem.watch((value) => {
        observed = value
      })
      await enabledItem.setValue(false)
      expect(observed).toBe(false)
      unwatch()
    })
  })
}
