import { isInternalUrl } from './isInternalUrl'

/**
 * 重複統合の対象になりうる URL かどうかを判定する。
 *
 * 空文字・`chrome://newtab/`・`about:blank`・内部 URL を対象外とする
 * （v1 の各所に散在していた除外判定を集約したもの）。
 *
 * @param url 判定対象の URL
 * @returns 統合対象になりうる場合 true
 */
export function isMergeableUrl(url: string): boolean {
	if (!url || url === 'chrome://newtab/' || url === 'about:blank') {
		return false
	}
	return !isInternalUrl(url)
}

if (import.meta.vitest) {
	const { describe, expect, it } = import.meta.vitest
	describe('isMergeableUrl', () => {
		it.each([
			'',
			'chrome://newtab/',
			'about:blank',
			'chrome://settings',
			'moz-extension://abc/page.html',
		])('対象外の URL を false と判定する: %s', (url) => {
			expect(isMergeableUrl(url)).toBe(false)
		})

		it.each(['https://example.com', 'http://example.com/path'])(
			'通常 URL を true と判定する: %s',
			(url) => {
				expect(isMergeableUrl(url)).toBe(true)
			},
		)
	})
}
