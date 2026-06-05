import { ResultAsync as ResultAsyncImpl, errAsync, okAsync } from 'neverthrow'
import type { ResultAsync } from 'neverthrow'
import type { TabOpError } from './types'
import { browser } from 'wxt/browser'
import { toTabOpError } from './toTabOpError'

/**
 * 指定タブを削除する。
 *
 * 既に閉じられている（`No tab with id`）場合は成功扱いとする（v1 踏襲）。
 * それ以外のエラーは握り潰さず `TabOpError` として返す。
 *
 * @param tabId 削除するタブ ID
 * @returns 操作結果
 */
export function removeTab(tabId: number): ResultAsync<void, TabOpError> {
	return ResultAsyncImpl.fromPromise(browser.tabs.remove(tabId), toTabOpError).orElse((error) =>
		error === 'tab-not-found'
			? okAsync<void, TabOpError>(undefined)
			: errAsync<void, TabOpError>(error),
	)
}

if (import.meta.vitest) {
	const { describe, expect, it, vi } = import.meta.vitest
	const { fakeBrowser } = await import('wxt/testing')

	describe('removeTab', () => {
		it('tabs.remove を呼び成功を返す', async () => {
			// fakeBrowser の tabs.remove は内部バグで通常タブ削除時に例外を投げるためモックする
			const removeSpy = vi.spyOn(fakeBrowser.tabs, 'remove').mockResolvedValue(undefined)
			const result = await removeTab(123)
			expect(result.isOk()).toBe(true)
			expect(removeSpy).toHaveBeenCalledWith(123)
			removeSpy.mockRestore()
		})

		it('既に閉じられたタブ（No tab with id）は成功扱い', async () => {
			const removeSpy = vi
				.spyOn(fakeBrowser.tabs, 'remove')
				.mockRejectedValue(new Error('No tab with id: 123'))
			const result = await removeTab(123)
			expect(result.isOk()).toBe(true)
			removeSpy.mockRestore()
		})

		it('その他のエラーは握り潰さず err を返す', async () => {
			const removeSpy = vi
				.spyOn(fakeBrowser.tabs, 'remove')
				.mockRejectedValue(new Error('permission denied'))
			const result = await removeTab(123)
			expect(result.isErr()).toBe(true)
			expect(result._unsafeUnwrapErr()).toBe('unknown')
			removeSpy.mockRestore()
		})
	})
}
