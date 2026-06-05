/** タブ操作の失敗を表す代数的データ型 */
export type TabOpError = 'tab-not-found' | 'timeout' | 'unknown'

/**
 * タブ判定・キャッシュ反映に必要な最小限のタブ情報。
 *
 * `@wxt-dev/browser` の `Tab` と `webextension-polyfill` の `Tabs.Tab` の
 * 双方から構造的に代入可能にするため、使用するフィールドのみに絞っている。
 */
export type TabSnapshot = {
	id?: number
	pinned: boolean
	title?: string
	url?: string
	windowId?: number
}

/** `onUpdated` の変更情報のうち判定・反映に使う最小限のフィールド */
export type TabChangeInfo = {
	pinned?: boolean
	status?: string
	url?: string
}
