import type { PinnedTabCache } from '../pinned/types'
import type { ProcessingTabs } from './createProcessingTabs'
import type { SerialQueue } from '../async/createSerialQueue'
import { incrementMergedStats } from '../settings/incrementMergedStats'
import { isMergeableUrl } from '../url/isMergeableUrl'
import { switchToPinnedTab } from './switchToPinnedTab'

/** `processTabUrl` の依存（DI） */
export type ProcessTabUrlDeps = {
	cache: PinnedTabCache
	enqueueStats: SerialQueue
	isEnabled: () => Promise<boolean>
	now: () => Date
	processingTabs: ProcessingTabs
}

/**
 * タブの URL を処理し、同一 URL のピン留めタブがあれば統合する中核処理。
 *
 * フロー:
 * 1. `isMergeableUrl` で内部 URL 等を検索前に除外
 * 2. `processingTabs.tryAcquire` で二重処理を防止（取得失敗なら return）
 * 3. `cache.whenReady()`（reject しない）→ `isEnabled()` 確認
 * 4. `findByUrl` でピン留めタブを検索し、`switchToPinnedTab` の **成功時のみ** 統計を更新
 *
 * この関数自体は reject しない（最外周の try/catch で `isEnabled` /
 * `enqueueStats` / `incrementMergedStats` の reject を握る）。
 *
 * @param deps 依存
 * @param tabId 処理対象タブ ID
 * @param url 処理対象 URL
 * @param windowId 処理対象タブのウィンドウ ID
 */
export async function processTabUrl(
	deps: ProcessTabUrlDeps,
	tabId: number,
	url: string,
	windowId: number,
): Promise<void> {
	// 内部 URL 等は検索前に除外（v1 踏襲）
	if (!isMergeableUrl(url)) {
		return
	}
	// 二重処理防止
	if (!deps.processingTabs.tryAcquire(tabId)) {
		return
	}

	try {
		// SW 起動直後のキャッシュ空 race を防ぐ（whenReady は reject しない）
		await deps.cache.whenReady()

		if (!(await deps.isEnabled())) {
			return
		}

		const pinned = deps.cache.findByUrl(url, { excludeTabId: tabId, preferWindowId: windowId })
		if (pinned === null) {
			return
		}

		const result = await switchToPinnedTab(pinned.id, tabId)
		if (result.isOk()) {
			// 統合成功時のみ統計を更新（直列キューで lost update を防止）
			await deps.enqueueStats(() => incrementMergedStats(deps.now()))
		}
	} catch {
		// isEnabled / enqueueStats / incrementMergedStats の reject を握り未処理 rejection を防ぐ
	} finally {
		deps.processingTabs.release(tabId)
	}
}

if (import.meta.vitest) {
	const { afterEach, beforeEach, describe, expect, it, vi } = import.meta.vitest
	const { fakeBrowser } = await import('wxt/testing')
	const { createPinnedTabCache } = await import('../pinned/createPinnedTabCache')
	const { createProcessingTabs } = await import('./createProcessingTabs')
	const { createSerialQueue } = await import('../async/createSerialQueue')
	const { statisticsItem } = await import('../settings/statisticsItem')

	const NOW = new Date('2026-06-05T12:00:00.000Z')

	// fakeBrowser の tabs.remove は通常タブ削除時に内部例外を投げるため成功でモックする
	const mockRemove = () => vi.spyOn(fakeBrowser.tabs, 'remove').mockResolvedValue(undefined)

	/** 実 fakeBrowser にピン留めタブを作成し、refresh 済みのキャッシュを構築する */
	const createPinned = async (url: string): Promise<{ id: number; windowId: number }> => {
		const tab = await fakeBrowser.tabs.create({ pinned: true, url })
		return { id: tab.id ?? -1, windowId: tab.windowId ?? -1 }
	}

	const makeDeps = (overrides: Partial<ProcessTabUrlDeps>): ProcessTabUrlDeps => ({
		cache: createPinnedTabCache(),
		enqueueStats: createSerialQueue(),
		isEnabled: () => Promise.resolve(true),
		now: () => NOW,
		processingTabs: createProcessingTabs(),
		...overrides,
	})

	const mergedTabs = async (): Promise<number> => (await statisticsItem.getValue()).mergedTabs

	describe('processTabUrl', () => {
		beforeEach(async () => {
			await fakeBrowser.windows.create({ focused: true })
		})
		afterEach(() => {
			vi.restoreAllMocks()
		})

		it('有効時: 同一 URL のピン留めタブがあれば削除して統計+1', async () => {
			const pinned = await createPinned('https://example.com/')
			const removeSpy = mockRemove()
			const deps = makeDeps({})
			await deps.cache.whenReady()

			const newTabId = pinned.id + 1000
			await processTabUrl(deps, newTabId, 'https://example.com/', pinned.windowId)

			expect(removeSpy).toHaveBeenCalledWith(newTabId)
			expect(await mergedTabs()).toBe(1)
		})

		it('無効時: no-op（統計も増えない）', async () => {
			const pinned = await createPinned('https://example.com/')
			const removeSpy = mockRemove()
			const deps = makeDeps({ isEnabled: () => Promise.resolve(false) })
			await deps.cache.whenReady()

			await processTabUrl(deps, pinned.id + 1000, 'https://example.com/', pinned.windowId)

			expect(removeSpy).not.toHaveBeenCalled()
			expect(await mergedTabs()).toBe(0)
		})

		it('自タブは除外される（自分自身とは統合しない）', async () => {
			const pinned = await createPinned('https://example.com/')
			const removeSpy = mockRemove()
			const deps = makeDeps({})
			await deps.cache.whenReady()

			// 処理対象タブ ID = ピン留めタブ ID（自分自身）
			await processTabUrl(deps, pinned.id, 'https://example.com/', pinned.windowId)

			expect(removeSpy).not.toHaveBeenCalled()
			expect(await mergedTabs()).toBe(0)
		})

		it('内部 URL は検索前に除外され何もしない', async () => {
			const removeSpy = mockRemove()
			const deps = makeDeps({})
			const whenReadySpy = vi.spyOn(deps.cache, 'whenReady')

			await processTabUrl(deps, 1, 'chrome://newtab/', 10)

			expect(whenReadySpy).not.toHaveBeenCalled()
			expect(removeSpy).not.toHaveBeenCalled()
		})

		it('処理中のタブは二重処理しない', async () => {
			const pinned = await createPinned('https://example.com/')
			const removeSpy = mockRemove()
			const deps = makeDeps({})
			await deps.cache.whenReady()
			const newTabId = pinned.id + 1000
			// 既に処理中の状態を作る
			deps.processingTabs.tryAcquire(newTabId)

			await processTabUrl(deps, newTabId, 'https://example.com/', pinned.windowId)

			expect(removeSpy).not.toHaveBeenCalled()
		})

		it('統合に失敗した場合は統計を増やさない', async () => {
			const pinned = await createPinned('https://example.com/')
			// remove が想定外エラーで失敗 → switchToPinnedTab は err
			vi.spyOn(fakeBrowser.tabs, 'remove').mockRejectedValue(new Error('permission denied'))
			const deps = makeDeps({})
			await deps.cache.whenReady()

			await processTabUrl(deps, pinned.id + 1000, 'https://example.com/', pinned.windowId)

			expect(await mergedTabs()).toBe(0)
		})

		it('統計 lost update 防止: 2 件並行でも mergedTabs===2', async () => {
			const a = await createPinned('https://a.com/')
			const b = await createPinned('https://b.com/')
			mockRemove()
			const deps = makeDeps({})
			await deps.cache.whenReady()

			await Promise.all([
				processTabUrl(deps, a.id + 1000, 'https://a.com/', a.windowId),
				processTabUrl(deps, b.id + 1000, 'https://b.com/', b.windowId),
			])

			expect(await mergedTabs()).toBe(2)
		})
	})
}
