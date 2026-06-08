import type { ResultAsync } from 'neverthrow'
import { ResultAsync as ResultAsyncImpl } from 'neverthrow'

import { delay } from '../async/delay'
import { withRetry } from '../async/withRetry'
import { removeTab } from './removeTab'
import { switchToTab } from './switchToTab'
import type { TabOpError } from './types'

/** リトライ設定（v1: maxRetries=3 / retryDelay=1000 / timeout=5000 を踏襲） */
const RETRY_OPTIONS = { attempts: 3, delayMs: 1000, timeoutMs: 5000 }
/** 遷移完了を確保するための待機時間（ミリ秒、v1 踏襲） */
const SWITCH_DELAY_MS = 100

/**
 * ピン留めタブへ遷移し、遷移成功後に新しいタブを削除する。
 *
 * `withRetry(switchToTab)` → `delay(100)` → `removeTab` を `andThen` で連結し、
 * 各段が成功した場合のみ次へ進む。
 *
 * @param pinnedTabId 遷移先のピン留めタブ ID
 * @param newTabId 削除する新規タブ ID
 * @returns 操作結果
 */
export function switchToPinnedTab(
  pinnedTabId: number,
  newTabId: number
): ResultAsync<void, TabOpError> {
  return withRetry(() => switchToTab(pinnedTabId), RETRY_OPTIONS)
    .andThen(() => ResultAsyncImpl.fromSafePromise(delay(SWITCH_DELAY_MS)))
    .andThen(() => removeTab(newTabId))
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest
  const { fakeBrowser } = await import('wxt/testing')

  describe('switchToPinnedTab', () => {
    it('ピン留めタブへ遷移し新規タブを削除する', async () => {
      const pinned = await fakeBrowser.tabs.create({
        active: false,
        pinned: true,
        url: 'https://example.com/',
      })
      const newTab = await fakeBrowser.tabs.create({ active: true, url: 'https://example.com/' })
      const updateSpy = vi.spyOn(fakeBrowser.tabs, 'update')
      // fakeBrowser の tabs.remove は内部バグで通常タブ削除時に例外を投げるためモックする
      const removeSpy = vi.spyOn(fakeBrowser.tabs, 'remove').mockResolvedValue(undefined)

      const result = await switchToPinnedTab(pinned.id ?? -1, newTab.id ?? -1)
      expect(result.isOk()).toBe(true)

      // ピン留めタブへの遷移が試みられ、新規タブの削除が呼ばれる
      expect(updateSpy).toHaveBeenCalledWith(pinned.id, { active: true })
      expect(removeSpy).toHaveBeenCalledWith(newTab.id)

      updateSpy.mockRestore()
      removeSpy.mockRestore()
    })
  })
}
