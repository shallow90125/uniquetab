/** 拡張機能の処理対象外とする内部スキーム */
const INTERNAL_SCHEMES = [
  'chrome:',
  'chrome-extension:',
  'about:',
  'edge:',
  'moz-extension:',
] as const

/**
 * ブラウザ内部 URL（`chrome:` や `about:` 等）かどうかを判定する。
 *
 * @param url 判定対象の URL
 * @returns 内部スキームで始まる場合 true
 */
export function isInternalUrl(url: string): boolean {
  return INTERNAL_SCHEMES.some((scheme) => url.startsWith(scheme))
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  describe('isInternalUrl', () => {
    it.each([
      'chrome://newtab/',
      'chrome-extension://abc/page.html',
      'about:blank',
      'edge://settings',
      'moz-extension://abc/page.html',
    ])('内部 URL を true と判定する: %s', (url) => {
      expect(isInternalUrl(url)).toBe(true)
    })

    it.each(['https://example.com', 'http://example.com', 'file:///tmp/a.html'])(
      '通常 URL を false と判定する: %s',
      (url) => {
        expect(isInternalUrl(url)).toBe(false)
      }
    )
  })
}
