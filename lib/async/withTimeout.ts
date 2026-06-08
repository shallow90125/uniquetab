import { ResultAsync, err } from 'neverthrow'
import type { Result } from 'neverthrow'

import type { TabOpError } from '../tab/types'

/**
 * `ResultAsync` 操作にタイムアウトを付与する。
 *
 * タイマーは reject ではなく `err('timeout')` を解決する Promise として `Promise.race` 相当で扱い、
 * 結果を `ResultAsync<T, TabOpError>` に正規化する。`op` 解決時はタイマーを解除する。
 *
 * @param op タイムアウトを付与する操作
 * @param ms タイムアウト時間（ミリ秒）
 * @returns タイムアウト付きの操作結果
 */
export function withTimeout<T>(
  op: ResultAsync<T, TabOpError>,
  ms: number
): ResultAsync<T, TabOpError> {
  const raced = new Promise<Result<T, TabOpError>>((resolve) => {
    const timer = setTimeout(() => {
      resolve(err('timeout'))
    }, ms)
    op.then(
      (result) => {
        clearTimeout(timer)
        resolve(result)
      },
      () => {
        clearTimeout(timer)
        resolve(err('unknown'))
      }
    )
  })
  return ResultAsync.fromSafePromise(raced).andThen((result) => result)
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest
  const { okAsync } = await import('neverthrow')

  describe('withTimeout', () => {
    it('期限内に解決すれば結果をそのまま返す', async () => {
      const result = await withTimeout(okAsync<number, TabOpError>(42), 1000)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe(42)
    })

    it('期限を超えると timeout を返す', async () => {
      vi.useFakeTimers()
      const slow = ResultAsync.fromSafePromise<number, TabOpError>(new Promise<number>(() => {}))
      const promise = withTimeout(slow, 5000)
      await vi.advanceTimersByTimeAsync(5000)
      const result = await promise
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe('timeout')
      vi.useRealTimers()
    })
  })
}
