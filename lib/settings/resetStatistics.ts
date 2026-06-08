import { statisticsItem } from './statisticsItem'
import { DEFAULT_STATISTICS } from './types'

/**
 * 統計情報を初期値にリセットする。
 */
export async function resetStatistics(): Promise<void> {
  await statisticsItem.setValue(DEFAULT_STATISTICS)
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  describe('resetStatistics', () => {
    it('統計を初期値に戻す', async () => {
      await statisticsItem.setValue({ lastMergeTime: '2026-06-05T12:00:00.000Z', mergedTabs: 7 })
      await resetStatistics()
      expect(await statisticsItem.getValue()).toEqual(DEFAULT_STATISTICS)
    })
  })
}
