import { statisticsItem } from './statisticsItem'

/**
 * 統合数を 1 加算し、最終統合時刻を更新する。
 *
 * `getValue`（fallback 適用済み）を読んでから `setValue` する。
 * `now` を引数注入することで決定論的にテストできる。
 *
 * @param now 最終統合時刻として記録する現在時刻
 */
export async function incrementMergedStats(now: Date): Promise<void> {
  const current = await statisticsItem.getValue()
  await statisticsItem.setValue({
    lastMergeTime: now.toISOString(),
    mergedTabs: current.mergedTabs + 1,
  })
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  describe('incrementMergedStats', () => {
    it('初回は mergedTabs を 1 にし lastMergeTime を記録する', async () => {
      const now = new Date('2026-06-05T12:00:00.000Z')
      await incrementMergedStats(now)
      expect(await statisticsItem.getValue()).toEqual({
        lastMergeTime: '2026-06-05T12:00:00.000Z',
        mergedTabs: 1,
      })
    })

    it('既存値に加算する', async () => {
      await statisticsItem.setValue({ lastMergeTime: null, mergedTabs: 3 })
      await incrementMergedStats(new Date('2026-06-05T12:00:00.000Z'))
      expect((await statisticsItem.getValue()).mergedTabs).toBe(4)
    })
  })
}
