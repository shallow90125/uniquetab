/**
 * 指定ミリ秒だけ待機する Promise を返す。
 *
 * @param ms 待機時間（ミリ秒）
 * @returns 待機後に解決する Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest
  describe('delay', () => {
    it('指定時間後に解決する', async () => {
      vi.useFakeTimers()
      let resolved = false
      const promise = delay(100).then(() => {
        resolved = true
      })
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(100)
      await promise
      expect(resolved).toBe(true)
      vi.useRealTimers()
    })
  })
}
