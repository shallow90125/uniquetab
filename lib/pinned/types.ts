import type { TabChangeInfo, TabSnapshot } from '../tab/types'

/** キャッシュに保持するピン留めタブのエントリ */
export type PinnedTabEntry = {
	id: number
	normalizedUrl: string
	title: string | undefined
	url: string
	windowId: number
}

/** `findByUrl` の検索オプション */
export type FindByUrlOptions = {
	excludeTabId: number
	preferWindowId: number
}

/** ピン留めタブのキャッシュ（公開 API） */
export type PinnedTabCache = {
	applyTabCreated: (tab: TabSnapshot) => void
	applyTabRemoved: (tabId: number) => void
	applyTabUpdated: (tabId: number, changeInfo: TabChangeInfo, tab: TabSnapshot) => void
	findByUrl: (url: string, options: FindByUrlOptions) => PinnedTabEntry | null
	refresh: () => Promise<void>
	whenReady: () => Promise<void>
}
