/** 処理中タブの二重処理を防ぐトラッカー */
export type ProcessingTabs = {
	release: (tabId: number) => void
	tryAcquire: (tabId: number) => boolean
}

/**
 * 処理中タブ ID を `Set` で管理するファクトリ。
 *
 * `tryAcquire` は未処理なら登録して true、既に処理中なら false を返す。
 * `release` は処理完了時に登録を解除する（class のインスタンス変数の関数型代替）。
 *
 * @returns 取得・解放 API
 */
export function createProcessingTabs(): ProcessingTabs {
	const processing = new Set<number>()

	return {
		release: (tabId) => {
			processing.delete(tabId)
		},
		tryAcquire: (tabId) => {
			if (processing.has(tabId)) {
				return false
			}
			processing.add(tabId)
			return true
		},
	}
}

if (import.meta.vitest) {
	const { describe, expect, it } = import.meta.vitest
	describe('createProcessingTabs', () => {
		it('初回 tryAcquire は true', () => {
			const p = createProcessingTabs()
			expect(p.tryAcquire(1)).toBe(true)
		})

		it('処理中の tabId の再取得は false', () => {
			const p = createProcessingTabs()
			p.tryAcquire(1)
			expect(p.tryAcquire(1)).toBe(false)
		})

		it('release 後は再取得できる', () => {
			const p = createProcessingTabs()
			p.tryAcquire(1)
			p.release(1)
			expect(p.tryAcquire(1)).toBe(true)
		})

		it('別 tabId は独立して取得できる', () => {
			const p = createProcessingTabs()
			p.tryAcquire(1)
			expect(p.tryAcquire(2)).toBe(true)
		})
	})
}
