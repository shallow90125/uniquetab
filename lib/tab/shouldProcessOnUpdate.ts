import type { TabChangeInfo, TabSnapshot } from './types'

/** `shouldProcessOnUpdate` の判定結果 */
export type UpdateDecision = {
  process: boolean
  url: string | null
}

/** 処理対象外の判定結果 */
const SKIP: UpdateDecision = { process: false, url: null }

/**
 * `tabs.onUpdated` で重複判定処理を起動すべきかを判定する。
 *
 * - ピン留めタブは対象外
 * - URL が変更された（`changeInfo.url`）か、読み込み完了（`status === 'complete'`）で
 *   タブに確定 URL がある場合に処理する
 * - 処理する場合は対象 URL（変更 URL 優先、無ければ現在の URL）を返す
 *
 * @param changeInfo 変更情報
 * @param tab 更新後のタブ
 * @returns 処理可否と対象 URL
 */
export function shouldProcessOnUpdate(changeInfo: TabChangeInfo, tab: TabSnapshot): UpdateDecision {
  if (tab.pinned) {
    return SKIP
  }

  const isReady = (url: string | undefined): url is string =>
    url !== undefined && url !== '' && url !== 'chrome://newtab/' && url !== 'about:blank'

  const urlChanged = isReady(changeInfo.url)
  const loadingComplete = changeInfo.status === 'complete' && isReady(tab.url)

  if (!urlChanged && !loadingComplete) {
    return SKIP
  }

  // 変更 URL を優先し、無ければ現在の URL を処理対象にする
  const url = changeInfo.url ?? tab.url ?? null
  return { process: true, url }
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest

  const makeTab = (overrides: Partial<TabSnapshot>): TabSnapshot => ({
    pinned: false,
    ...overrides,
  })

  describe('shouldProcessOnUpdate', () => {
    it('ピン留めタブは処理しない', () => {
      expect(
        shouldProcessOnUpdate(
          { status: 'complete' },
          makeTab({ pinned: true, url: 'https://example.com' })
        )
      ).toEqual(SKIP)
    })

    it('URL 変更時は変更 URL を対象に処理する', () => {
      expect(
        shouldProcessOnUpdate({ url: 'https://example.com/a' }, makeTab({ url: 'https://old.com' }))
      ).toEqual({
        process: true,
        url: 'https://example.com/a',
      })
    })

    it('読み込み完了時は現在の URL を対象に処理する', () => {
      expect(
        shouldProcessOnUpdate({ status: 'complete' }, makeTab({ url: 'https://example.com' }))
      ).toEqual({
        process: true,
        url: 'https://example.com',
      })
    })

    it('変更 URL が未確定なら処理しない', () => {
      expect(
        shouldProcessOnUpdate({ url: 'chrome://newtab/' }, makeTab({ url: 'chrome://newtab/' }))
      ).toEqual(SKIP)
    })

    it('status のみで URL 未確定なら処理しない', () => {
      expect(
        shouldProcessOnUpdate({ status: 'complete' }, makeTab({ url: 'about:blank' }))
      ).toEqual(SKIP)
    })

    it('関係ない changeInfo（status/url 無し）では処理しない', () => {
      expect(shouldProcessOnUpdate({}, makeTab({ url: 'https://example.com' }))).toEqual(SKIP)
    })
  })
}
