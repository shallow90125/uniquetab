import type { TabChangeInfo, TabSnapshot } from '../tab/types'
import type { ProcessTabUrlDeps } from '../tab/processTabUrl'
import { processTabUrl } from '../tab/processTabUrl'
import { shouldProcessOnCreate } from '../tab/shouldProcessOnCreate'
import { shouldProcessOnUpdate } from '../tab/shouldProcessOnUpdate'

/** リスナー登録先のイベント群（fakeBrowser でも実ブラウザでも満たせる最小形） */
export type TabEventTarget = {
	onCreated: { addListener: (callback: (tab: TabSnapshot) => void) => void }
	onInstalled: { addListener: (callback: () => void) => void }
	onRemoved: { addListener: (callback: (tabId: number) => void) => void }
	onUpdated: {
		addListener: (
			callback: (tabId: number, changeInfo: TabChangeInfo, tab: TabSnapshot) => void,
		) => void
	}
}

/**
 * タブ関連イベントへのリスナーを登録する配線ロジック。
 *
 * 各イベントで「キャッシュ反映 → 処理判定」の順に実行する。
 * `entrypoints/background.ts` はこの関数を呼ぶだけの薄い層とし、配線を fakeBrowser で結合テストできる。
 *
 * @param target 購読対象のイベント群
 * @param deps 処理に必要な依存
 */
export function registerTabListeners(target: TabEventTarget, deps: ProcessTabUrlDeps): void {
	target.onCreated.addListener((tab) => {
		deps.cache.applyTabCreated(tab)
		const { id, url, windowId } = tab
		if (shouldProcessOnCreate(tab) && id !== undefined && url && windowId !== undefined) {
			void processTabUrl(deps, id, url, windowId)
		}
	})

	target.onUpdated.addListener((tabId, changeInfo, tab) => {
		deps.cache.applyTabUpdated(tabId, changeInfo, tab)
		const decision = shouldProcessOnUpdate(changeInfo, tab)
		if (decision.process && decision.url && tab.windowId !== undefined) {
			void processTabUrl(deps, tabId, decision.url, tab.windowId)
		}
	})

	target.onRemoved.addListener((tabId) => {
		deps.cache.applyTabRemoved(tabId)
	})

	target.onInstalled.addListener(() => {
		void deps.cache.refresh()
	})
}

if (import.meta.vitest) {
	const { afterEach, beforeEach, describe, expect, it, vi } = import.meta.vitest
	const { fakeBrowser } = await import('wxt/testing')
	const { createPinnedTabCache } = await import('../pinned/createPinnedTabCache')
	const { createProcessingTabs } = await import('../tab/createProcessingTabs')
	const { createSerialQueue } = await import('../async/createSerialQueue')
	const { statisticsItem } = await import('../settings/statisticsItem')

	const NOW = new Date('2026-06-05T12:00:00.000Z')

	type Listeners = {
		created: Array<(tab: TabSnapshot) => void>
		installed: Array<() => void>
		removed: Array<(tabId: number) => void>
		updated: Array<(tabId: number, changeInfo: TabChangeInfo, tab: TabSnapshot) => void>
	}

	const setupTarget = (): { listeners: Listeners; target: TabEventTarget } => {
		const listeners: Listeners = { created: [], installed: [], removed: [], updated: [] }
		const target: TabEventTarget = {
			onCreated: { addListener: (callback) => listeners.created.push(callback) },
			onInstalled: { addListener: (callback) => listeners.installed.push(callback) },
			onRemoved: { addListener: (callback) => listeners.removed.push(callback) },
			onUpdated: { addListener: (callback) => listeners.updated.push(callback) },
		}
		return { listeners, target }
	}

	const makeDeps = (overrides: Partial<ProcessTabUrlDeps>): ProcessTabUrlDeps => ({
		cache: createPinnedTabCache(),
		enqueueStats: createSerialQueue(),
		isEnabled: () => Promise.resolve(true),
		now: () => NOW,
		processingTabs: createProcessingTabs(),
		...overrides,
	})

	const createPinned = async (url: string): Promise<{ id: number; windowId: number }> => {
		const tab = await fakeBrowser.tabs.create({ pinned: true, url })
		return { id: tab.id ?? -1, windowId: tab.windowId ?? -1 }
	}

	// switchToPinnedTab 内の delay(100) と統計更新を待つ（fire-and-forget な処理の完了待ち）
	const flush = () => new Promise((resolve) => setTimeout(resolve, 200))

	const mergedTabs = async (): Promise<number> => (await statisticsItem.getValue()).mergedTabs

	describe('registerTabListeners', () => {
		beforeEach(async () => {
			await fakeBrowser.windows.create({ focused: true })
		})
		afterEach(() => {
			vi.restoreAllMocks()
		})

		it('onCreated: 確定 URL の重複タブを統合する', async () => {
			const pinned = await createPinned('https://example.com/')
			const removeSpy = vi.spyOn(fakeBrowser.tabs, 'remove').mockResolvedValue(undefined)
			const deps = makeDeps({})
			const { listeners, target } = setupTarget()
			registerTabListeners(target, deps)
			await deps.cache.whenReady()

			const newTabId = pinned.id + 1000
			listeners.created[0]?.({
				id: newTabId,
				pinned: false,
				url: 'https://example.com/',
				windowId: pinned.windowId,
			})
			await flush()

			expect(removeSpy).toHaveBeenCalledWith(newTabId)
			expect(await mergedTabs()).toBe(1)
		})

		it('onCreated 未確定 → onUpdated 確定の順で統合する', async () => {
			const pinned = await createPinned('https://example.com/')
			const removeSpy = vi.spyOn(fakeBrowser.tabs, 'remove').mockResolvedValue(undefined)
			const deps = makeDeps({})
			const { listeners, target } = setupTarget()
			registerTabListeners(target, deps)
			await deps.cache.whenReady()

			const newTabId = pinned.id + 1000
			// 未確定 URL では統合しない
			listeners.created[0]?.({
				id: newTabId,
				pinned: false,
				url: undefined,
				windowId: pinned.windowId,
			})
			await flush()
			expect(removeSpy).not.toHaveBeenCalled()

			// URL 確定で統合される
			listeners.updated[0]?.(
				newTabId,
				{ url: 'https://example.com/' },
				{ id: newTabId, pinned: false, url: 'https://example.com/', windowId: pinned.windowId },
			)
			await flush()
			expect(removeSpy).toHaveBeenCalledWith(newTabId)
		})

		it('onRemoved: キャッシュから除去する', async () => {
			const deps = makeDeps({})
			const applyRemovedSpy = vi.spyOn(deps.cache, 'applyTabRemoved')
			const { listeners, target } = setupTarget()
			registerTabListeners(target, deps)

			listeners.removed[0]?.(42)

			expect(applyRemovedSpy).toHaveBeenCalledWith(42)
		})

		it('onInstalled: キャッシュを refresh する', async () => {
			const deps = makeDeps({})
			const refreshSpy = vi.spyOn(deps.cache, 'refresh')
			const { listeners, target } = setupTarget()
			registerTabListeners(target, deps)

			listeners.installed[0]?.()

			expect(refreshSpy).toHaveBeenCalled()
		})

		it('disabled では統合しない', async () => {
			const pinned = await createPinned('https://example.com/')
			const removeSpy = vi.spyOn(fakeBrowser.tabs, 'remove').mockResolvedValue(undefined)
			const deps = makeDeps({ isEnabled: () => Promise.resolve(false) })
			const { listeners, target } = setupTarget()
			registerTabListeners(target, deps)
			await deps.cache.whenReady()

			listeners.created[0]?.({
				id: pinned.id + 1000,
				pinned: false,
				url: 'https://example.com/',
				windowId: pinned.windowId,
			})
			await flush()

			expect(removeSpy).not.toHaveBeenCalled()
			expect(await mergedTabs()).toBe(0)
		})
	})
}
