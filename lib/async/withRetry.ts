import type { Result, ResultAsync } from 'neverthrow'
import { ResultAsync as ResultAsyncImpl } from 'neverthrow'

import type { TabOpError } from '../tab/types'
import { delay } from './delay'
import { withTimeout } from './withTimeout'

/** `withRetry` のオプション */
export type RetryOptions = {
  /** 合計試行回数（リトライ追加回数ではない） */
  attempts: number
  /** 各失敗後の待機時間（ミリ秒） */
  delayMs: number
  /** 1 試行あたりのタイムアウト（ミリ秒） */
  timeoutMs: number
}

/**
 * `ResultAsync` 操作をタイムアウト付きでリトライする。
 *
 * `attempts` 回まで試行し、各失敗後に `delayMs` 待機する。
 * 全失敗時は最後の `TabOpError` をそのまま伝播する（潰さない）。
 *
 * @param op 試行する操作を生成する関数（試行ごとに新規生成）
 * @param options リトライ設定
 * @returns 最初に成功した結果、または最後の失敗
 */
export function withRetry<T>(
  op: () => ResultAsync<T, TabOpError>,
  options: RetryOptions
): ResultAsync<T, TabOpError> {
  const run = async (): Promise<Result<T, TabOpError>> => {
    let last = await withTimeout(op(), options.timeoutMs)
    for (let attempt = 2; attempt <= options.attempts; attempt++) {
      if (last.isOk()) {
        return last
      }
      await delay(options.delayMs)
      last = await withTimeout(op(), options.timeoutMs)
    }
    return last
  }
  return ResultAsyncImpl.fromSafePromise(run()).andThen((result) => result)
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  const { errAsync, okAsync } = await import('neverthrow')

  const options: RetryOptions = { attempts: 3, delayMs: 1, timeoutMs: 1000 }

  describe('withRetry', () => {
    it('初回成功なら 1 回で返す', async () => {
      let calls = 0
      const result = await withRetry(() => {
        calls++
        return okAsync<number, TabOpError>(1)
      }, options)
      expect(result._unsafeUnwrap()).toBe(1)
      expect(calls).toBe(1)
    })

    it('途中で成功すればそれ以降は試行しない', async () => {
      let calls = 0
      const result = await withRetry(() => {
        calls++
        return calls < 3 ? errAsync<number, TabOpError>('unknown') : okAsync<number, TabOpError>(7)
      }, options)
      expect(result._unsafeUnwrap()).toBe(7)
      expect(calls).toBe(3)
    })

    it('全失敗時は attempts 回試行し最後のエラーを伝播する', async () => {
      let calls = 0
      const result = await withRetry(() => {
        calls++
        return errAsync<number, TabOpError>('tab-not-found')
      }, options)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr()).toBe('tab-not-found')
      expect(calls).toBe(3)
    })
  })
}
