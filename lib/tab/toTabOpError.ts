import type { TabOpError } from './types'

/**
 * 例外を `TabOpError` に分類する。
 *
 * タブ不在を表すメッセージ（実ブラウザの `No tab with id` / fakeBrowser の `Tab not found`）は
 * `tab-not-found`、それ以外は `unknown` とする。
 *
 * @param error 捕捉した例外
 * @returns 分類された `TabOpError`
 */
export function toTabOpError(error: unknown): TabOpError {
	const message = error instanceof Error ? error.message : String(error)
	if (message.includes('No tab with id') || message.includes('Tab not found')) {
		return 'tab-not-found'
	}
	return 'unknown'
}

if (import.meta.vitest) {
	const { describe, expect, it } = import.meta.vitest
	describe('toTabOpError', () => {
		it('実ブラウザのタブ不在メッセージを tab-not-found に分類する', () => {
			expect(toTabOpError(new Error('No tab with id: 42'))).toBe('tab-not-found')
		})

		it('fakeBrowser のタブ不在メッセージを tab-not-found に分類する', () => {
			expect(toTabOpError(new Error('Tab not found'))).toBe('tab-not-found')
		})

		it('その他のエラーは unknown に分類する', () => {
			expect(toTabOpError(new Error('something else'))).toBe('unknown')
		})

		it('Error 以外も unknown に分類する', () => {
			expect(toTabOpError('boom')).toBe('unknown')
		})
	})
}
