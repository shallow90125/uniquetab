import type { TabSnapshot } from '../tab/types'
import { normalizeUrl } from '../url/normalizeUrl'
import { collectPinnedTabs } from './collectPinnedTabs'
import type { FindByUrlOptions, PinnedTabCache, PinnedTabEntry } from './types'

/** 内部 Map から指定 tabId のエントリを全走査で除去する（空配列キーは削除） */
function removeTabFromMap(map: Map<string, PinnedTabEntry[]>, tabId: number): void {
  for (const [key, entries] of map) {
    const filtered = entries.filter((entry) => entry.id !== tabId)
    if (filtered.length === 0) {
      map.delete(key)
    } else if (filtered.length !== entries.length) {
      map.set(key, filtered)
    }
  }
}

/** 内部 Map にエントリを追加する（同一 normalizedUrl は配列で複数保持） */
function addEntryToMap(map: Map<string, PinnedTabEntry[]>, entry: PinnedTabEntry): void {
  const list = map.get(entry.normalizedUrl) ?? []
  list.push(entry)
  map.set(entry.normalizedUrl, list)
}

/** タブ情報をエントリに変換する（必須フィールド欠落時は null） */
function toEntry(tab: TabSnapshot): PinnedTabEntry | null {
  const { id, title, url, windowId } = tab
  if (id === undefined || windowId === undefined || url === undefined) {
    return null
  }
  return { id, normalizedUrl: normalizeUrl(url), title, url, windowId }
}

/**
 * ピン留めタブのキャッシュファクトリ。
 *
 * クロージャに `Map<normalizedUrl, PinnedTabEntry[]>`（値は配列 = 複数ウィンドウ同 URL 対応）と
 * 排他的な refresh チェーンを閉じ込める（class インスタンスの関数型代替）。
 *
 * 不変条件:
 * - 生成時に初回 `refresh()` を開始し `ready` に束ねる。`whenReady()` は reject しない。
 * - `refresh()` は新 Map をローカル構築し、`collectPinnedTabs()` 完了後に内部参照を一括 swap する
 *   （構築途中の Map を `findByUrl` に晒さない）。多重 refresh は直列化する。
 * - refresh 失敗時は既存 snapshot を維持する（swap しない）。
 * - refresh 中に届いた `applyTab*` は保留バッファに積み、swap 後に再適用してから解決する。
 *
 * @returns ピン留めタブキャッシュ API
 */
export function createPinnedTabCache(): PinnedTabCache {
  let cache = new Map<string, PinnedTabEntry[]>()
  // refresh の await 中だけ非 null。apply 操作をここに退避する
  let pendingOps: Array<(map: Map<string, PinnedTabEntry[]>) => void> | null = null
  // 直列化のための refresh チェーン
  let refreshChain: Promise<void> = Promise.resolve()

  const doRefresh = async (): Promise<void> => {
    pendingOps = []
    const result = await collectPinnedTabs()
    const buffered = pendingOps
    pendingOps = null

    if (result.isErr()) {
      // 失敗時は swap せず現行 snapshot を維持し、退避分のみ現行に適用
      for (const op of buffered) {
        op(cache)
      }
      return
    }

    // 新 Map を構築して原子的に swap
    const next = new Map<string, PinnedTabEntry[]>()
    for (const entry of result.value) {
      addEntryToMap(next, entry)
    }
    cache = next

    // refresh 中に届いた apply を再適用
    for (const op of buffered) {
      op(cache)
    }
  }

  const refresh = (): Promise<void> => {
    // 失敗時も後続を止めないよう onRejected でも doRefresh を継続
    refreshChain = refreshChain.then(doRefresh, doRefresh)
    return refreshChain
  }

  // 生成時に初回 refresh を開始
  const ready = refresh()

  const runOrBuffer = (op: (map: Map<string, PinnedTabEntry[]>) => void): void => {
    if (pendingOps) {
      pendingOps.push(op)
      return
    }
    op(cache)
  }

  const applyUpsert = (tab: TabSnapshot): void => {
    runOrBuffer((map) => {
      // stale 排除: まず tabId を全エントリから除去
      if (tab.id !== undefined) {
        removeTabFromMap(map, tab.id)
      }
      // ピン留め かつ URL 確定の場合のみ再登録
      if (tab.pinned) {
        const entry = toEntry(tab)
        if (entry !== null) {
          addEntryToMap(map, entry)
        }
      }
    })
  }

  return {
    applyTabCreated: (tab) => {
      applyUpsert(tab)
    },
    applyTabRemoved: (tabId) => {
      runOrBuffer((map) => {
        removeTabFromMap(map, tabId)
      })
    },
    applyTabUpdated: (_tabId, _changeInfo, tab) => {
      applyUpsert(tab)
    },
    findByUrl: (url, options: FindByUrlOptions) => {
      const entries = cache.get(normalizeUrl(url))
      if (entries === undefined || entries.length === 0) {
        return null
      }
      const candidates = entries.filter((entry) => entry.id !== options.excludeTabId)
      if (candidates.length === 0) {
        return null
      }
      const preferred = candidates.find((entry) => entry.windowId === options.preferWindowId)
      return preferred ?? candidates[0] ?? null
    },
    refresh,
    whenReady: () => ready,
  }
}

if (import.meta.vitest) {
  const { describe, expect, it, vi } = import.meta.vitest
  const { fakeBrowser } = await import('wxt/testing')

  const makeTab = (overrides: Partial<TabSnapshot>): TabSnapshot => ({
    pinned: false,
    ...overrides,
  })

  const opts = (overrides: Partial<FindByUrlOptions>): FindByUrlOptions => ({
    excludeTabId: -1,
    preferWindowId: -1,
    ...overrides,
  })

  describe('createPinnedTabCache', () => {
    it('whenReady は reject しない', async () => {
      const cache = createPinnedTabCache()
      await expect(cache.whenReady()).resolves.toBeUndefined()
    })

    it('refresh で既存のピン留めタブを取り込む', async () => {
      await fakeBrowser.tabs.create({ pinned: true, url: 'https://example.com/' })
      const cache = createPinnedTabCache()
      await cache.whenReady()
      const found = cache.findByUrl('https://example.com/', opts({}))
      expect(found?.url).toBe('https://example.com/')
    })

    it('applyTabCreated で追加し findByUrl で正規化一致する', async () => {
      const cache = createPinnedTabCache()
      await cache.whenReady()
      cache.applyTabCreated(
        makeTab({ id: 1, pinned: true, url: 'http://www.example.com/', windowId: 10 })
      )
      const found = cache.findByUrl('https://example.com', opts({}))
      expect(found?.id).toBe(1)
    })

    it('excludeTabId で自タブを除外する', async () => {
      const cache = createPinnedTabCache()
      await cache.whenReady()
      cache.applyTabCreated(
        makeTab({ id: 1, pinned: true, url: 'https://example.com/', windowId: 10 })
      )
      expect(cache.findByUrl('https://example.com/', opts({ excludeTabId: 1 }))).toBeNull()
    })

    it('preferWindowId が一致するエントリを優先する', async () => {
      const cache = createPinnedTabCache()
      await cache.whenReady()
      cache.applyTabCreated(
        makeTab({ id: 1, pinned: true, url: 'https://example.com/', windowId: 10 })
      )
      cache.applyTabCreated(
        makeTab({ id: 2, pinned: true, url: 'https://example.com/', windowId: 20 })
      )
      expect(cache.findByUrl('https://example.com/', opts({ preferWindowId: 20 }))?.id).toBe(2)
    })

    it('複数ウィンドウ同 URL: 一方を remove しても他方が残る', async () => {
      const cache = createPinnedTabCache()
      await cache.whenReady()
      cache.applyTabCreated(
        makeTab({ id: 1, pinned: true, url: 'https://example.com/', windowId: 10 })
      )
      cache.applyTabCreated(
        makeTab({ id: 2, pinned: true, url: 'https://example.com/', windowId: 20 })
      )
      cache.applyTabRemoved(1)
      expect(cache.findByUrl('https://example.com/', opts({}))?.id).toBe(2)
    })

    it('applyTabUpdated で別 URL に遷移すると旧 URL から消える', async () => {
      const cache = createPinnedTabCache()
      await cache.whenReady()
      cache.applyTabCreated(makeTab({ id: 1, pinned: true, url: 'https://old.com/', windowId: 10 }))
      cache.applyTabUpdated(
        1,
        { url: 'https://new.com/' },
        makeTab({ id: 1, pinned: true, url: 'https://new.com/', windowId: 10 })
      )
      expect(cache.findByUrl('https://old.com/', opts({}))).toBeNull()
      expect(cache.findByUrl('https://new.com/', opts({}))?.id).toBe(1)
    })

    it('applyTabUpdated でピン解除するとキャッシュから消える', async () => {
      const cache = createPinnedTabCache()
      await cache.whenReady()
      cache.applyTabCreated(
        makeTab({ id: 1, pinned: true, url: 'https://example.com/', windowId: 10 })
      )
      cache.applyTabUpdated(
        1,
        { pinned: false },
        makeTab({ id: 1, pinned: false, url: 'https://example.com/', windowId: 10 })
      )
      expect(cache.findByUrl('https://example.com/', opts({}))).toBeNull()
    })

    it('refresh 失敗時は既存 snapshot を維持する', async () => {
      await fakeBrowser.tabs.create({ pinned: true, url: 'https://example.com/' })
      const cache = createPinnedTabCache()
      await cache.whenReady()

      const spy = vi.spyOn(fakeBrowser.tabs, 'query').mockRejectedValueOnce(new Error('boom'))
      await cache.refresh()
      spy.mockRestore()

      // 失敗しても旧スナップショットが残る
      expect(cache.findByUrl('https://example.com/', opts({}))?.url).toBe('https://example.com/')
    })

    it('refresh 中に届いた apply は swap 後に再適用される', async () => {
      // query の解決を外部から制御するための deferred（空配列で解決するため要素型は never[]）
      let resolveQuery!: (tabs: never[]) => void
      const queryPromise = new Promise<never[]>((resolve) => {
        resolveQuery = resolve
      })
      const spy = vi.spyOn(fakeBrowser.tabs, 'query').mockReturnValue(queryPromise)

      const cache = createPinnedTabCache()
      // doRefresh が collectPinnedTabs() の await で停止するまで待つ
      await new Promise((resolve) => setTimeout(resolve, 0))
      // refresh の await 中に apply を発火（バッファに積まれる）
      cache.applyTabCreated(
        makeTab({ id: 99, pinned: true, url: 'https://buffered.com/', windowId: 10 })
      )
      // collect 完了
      resolveQuery([])
      await cache.whenReady()
      spy.mockRestore()

      expect(cache.findByUrl('https://buffered.com/', opts({}))?.id).toBe(99)
    })
  })
}
