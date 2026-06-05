import type { ResultAsync } from 'neverthrow'
import { ResultAsync as ResultAsyncImpl } from 'neverthrow'
import type { TabOpError } from './types'
import { browser } from 'wxt/browser'
import { toTabOpError } from './toTabOpError'

/**
 * 指定タブをアクティブにし、そのウィンドウを前面に表示する。
 *
 * `tabs.get` で得た `windowId` が undefined の場合は `windows.update` を skip する
 * （明示 guard、非 null assertion 不使用）。
 *
 * @param tabId 遷移先のタブ ID
 * @returns 操作結果
 */
export function switchToTab(tabId: number): ResultAsync<void, TabOpError> {
	const run = async (): Promise<void> => {
		await browser.tabs.update(tabId, { active: true })
		const tab = await browser.tabs.get(tabId)
		if (tab.windowId !== undefined) {
			await browser.windows.update(tab.windowId, { focused: true })
		}
	}
	return ResultAsyncImpl.fromPromise(run(), toTabOpError)
}

if (import.meta.vitest) {
	const { describe, expect, it, vi } = import.meta.vitest
	const { fakeBrowser } = await import('wxt/testing')

	describe('switchToTab', () => {
		it('対象タブをアクティブにしウィンドウを前面化する', async () => {
			const tab = await fakeBrowser.tabs.create({ active: false, url: 'https://example.com/' })
			const updateSpy = vi.spyOn(fakeBrowser.tabs, 'update')
			const windowSpy = vi.spyOn(fakeBrowser.windows, 'update')

			const result = await switchToTab(tab.id ?? -1)
			expect(result.isOk()).toBe(true)
			expect(updateSpy).toHaveBeenCalledWith(tab.id, { active: true })
			expect(windowSpy).toHaveBeenCalledWith(tab.windowId, { focused: true })

			updateSpy.mockRestore()
			windowSpy.mockRestore()
		})

		it('存在しないタブは tab-not-found を返す', async () => {
			const result = await switchToTab(999_999)
			expect(result.isErr()).toBe(true)
			expect(result._unsafeUnwrapErr()).toBe('tab-not-found')
		})
	})
}
