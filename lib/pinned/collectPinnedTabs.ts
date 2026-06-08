import type { ResultAsync } from 'neverthrow'
import { ResultAsync as ResultAsyncImpl } from 'neverthrow'
import { browser } from 'wxt/browser'

import type { TabOpError } from '../tab/types'
import { normalizeUrl } from '../url/normalizeUrl'
import type { PinnedTabEntry } from './types'

/**
 * 全ウィンドウのピン留めタブを取得し `PinnedTabEntry[]` を生成する。
 *
 * `id` / `windowId` / `url` のいずれかが undefined のタブは除外する
 * （非 null assertion を使わず明示 guard）。
 *
 * @returns ピン留めタブのエントリ配列（取得失敗時は `TabOpError`）
 */
export function collectPinnedTabs(): ResultAsync<PinnedTabEntry[], TabOpError> {
  return ResultAsyncImpl.fromPromise(
    browser.tabs.query({ pinned: true }),
    (): TabOpError => 'unknown'
  ).map((tabs) => {
    const entries: PinnedTabEntry[] = []
    for (const tab of tabs) {
      const { id, title, url, windowId } = tab
      if (id === undefined || windowId === undefined || url === undefined) {
        continue
      }
      entries.push({ id, normalizedUrl: normalizeUrl(url), title, url, windowId })
    }
    return entries
  })
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  const { fakeBrowser } = await import('wxt/testing')

  describe('collectPinnedTabs', () => {
    it('ピン留めタブのみを正規化付きで返す', async () => {
      await fakeBrowser.windows.create({ focused: true })
      await fakeBrowser.tabs.create({ pinned: true, url: 'http://www.example.com/' })
      await fakeBrowser.tabs.create({ pinned: false, url: 'https://other.com/' })

      const result = await collectPinnedTabs()
      expect(result.isOk()).toBe(true)
      const entries = result._unsafeUnwrap()
      expect(entries).toHaveLength(1)
      expect(entries[0]?.url).toBe('http://www.example.com/')
      expect(entries[0]?.normalizedUrl).toBe('https://example.com/')
    })

    it('url が無いピン留めタブは除外する', async () => {
      await fakeBrowser.windows.create({ focused: true })
      await fakeBrowser.tabs.create({ pinned: true })

      const result = await collectPinnedTabs()
      expect(result._unsafeUnwrap()).toHaveLength(0)
    })
  })
}
