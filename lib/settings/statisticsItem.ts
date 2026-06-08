import { storage } from 'wxt/utils/storage'

import { DEFAULT_STATISTICS } from './types'
import type { Statistics } from './types'

/**
 * 統合の統計情報。
 *
 * v1 の `chrome.storage.sync` の `statistics` キーと同一形なのでデータが引き継がれる。
 */
export const statisticsItem = storage.defineItem<Statistics>('sync:statistics', {
  fallback: DEFAULT_STATISTICS,
})

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  describe('statisticsItem', () => {
    it('未設定時は DEFAULT_STATISTICS を返す', async () => {
      expect(await statisticsItem.getValue()).toEqual(DEFAULT_STATISTICS)
    })

    it('値を往復できる', async () => {
      const value: Statistics = { lastMergeTime: '2026-06-05T12:00:00.000Z', mergedTabs: 5 }
      await statisticsItem.setValue(value)
      expect(await statisticsItem.getValue()).toEqual(value)
    })
  })
}
