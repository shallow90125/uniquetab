import { createPinnedTabCache } from '@/lib/pinned/createPinnedTabCache'
import { createProcessingTabs } from '@/lib/tab/createProcessingTabs'
import { createSerialQueue } from '@/lib/async/createSerialQueue'
import { enabledItem } from '@/lib/settings/enabledItem'
import { registerTabListeners } from '@/lib/background/registerTabListeners'

export default defineBackground(() => {
	const cache = createPinnedTabCache() // 生成時に初回 refresh を開始
	const processingTabs = createProcessingTabs()
	const enqueueStats = createSerialQueue()

	registerTabListeners(
		{
			onCreated: browser.tabs.onCreated,
			onInstalled: browser.runtime.onInstalled,
			onRemoved: browser.tabs.onRemoved,
			onUpdated: browser.tabs.onUpdated,
		},
		{
			cache,
			enqueueStats,
			isEnabled: () => enabledItem.getValue(),
			now: () => new Date(),
			processingTabs,
		},
	)
})
