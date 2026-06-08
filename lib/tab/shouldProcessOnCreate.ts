import type { TabSnapshot } from './types'

/**
 * `tabs.onCreated` で重複判定処理を起動すべきかを判定する。
 *
 * - ピン留めタブは対象外（ピン留め同士は統合しない）
 * - URL 未確定（空 / `chrome://newtab/` / `about:blank`）は対象外
 *   （この場合は後続の `onUpdated` で処理される）
 *
 * @param tab 作成されたタブ
 * @returns 処理を起動すべき場合 true
 */
export function shouldProcessOnCreate(tab: TabSnapshot): boolean {
  if (tab.pinned) {
    return false
  }
  const { url } = tab
  if (!url || url === 'chrome://newtab/' || url === 'about:blank') {
    return false
  }
  return true
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  const makeTab = (overrides: Partial<TabSnapshot>): TabSnapshot => ({
    pinned: false,
    ...overrides,
  })

  describe('shouldProcessOnCreate', () => {
    it('ピン留めタブは処理しない', () => {
      expect(shouldProcessOnCreate(makeTab({ pinned: true, url: 'https://example.com' }))).toBe(
        false
      )
    })

    it('URL 未設定なら処理しない', () => {
      expect(shouldProcessOnCreate(makeTab({ url: undefined }))).toBe(false)
    })

    it.each(['chrome://newtab/', 'about:blank'])('未確定 URL なら処理しない: %s', (url) => {
      expect(shouldProcessOnCreate(makeTab({ url }))).toBe(false)
    })

    it('通常タブ + 確定 URL なら処理する', () => {
      expect(shouldProcessOnCreate(makeTab({ url: 'https://example.com' }))).toBe(true)
    })
  })
}
