/**
 * URL を比較用に正規化する。
 *
 * - `http:` を `https:` に統一する（その他のスキームはそのまま）
 * - 先頭の `www.` を削除する
 * - 末尾のスラッシュを削除する（ルートパスはブラウザ正規形の `/` に統一）
 * - ハッシュ（`#...`）を削除する
 * - クエリ文字列は保持する
 *
 * URL オブジェクトで再構築することで `example.com` と `example.com/` のような
 * 等価な表記を同一の正規形に揃える。パースに失敗した場合は原文をそのまま返す。
 *
 * @param url 正規化対象の URL
 * @returns 正規化された URL（失敗時は原文）
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url)

    // プロトコルを https に統一（http のみ。ftp 等は維持）
    const protocol = parsed.protocol === 'http:' ? 'https:' : parsed.protocol

    // www. プレフィックスを削除（host は port を含む）
    const host = parsed.host.replace(/^www\./, '')

    // 末尾スラッシュを削除（ルートパス `/` は維持しブラウザ正規形に揃える）
    const pathname =
      parsed.pathname !== '/' && parsed.pathname.endsWith('/')
        ? parsed.pathname.slice(0, -1)
        : parsed.pathname

    // ハッシュは捨て、クエリは保持して再構築
    return `${protocol}//${host}${pathname}${parsed.search}`
  } catch {
    return url
  }
}

if (import.meta.vitest) {
  const { describe, expect, it } = import.meta.vitest
  describe('normalizeUrl', () => {
    it('http を https に統一する', () => {
      expect(normalizeUrl('http://example.com/')).toBe('https://example.com/')
    })

    it('先頭の www. を削除する', () => {
      expect(normalizeUrl('https://www.example.com/')).toBe('https://example.com/')
    })

    it('末尾のスラッシュを削除する（ルート以外）', () => {
      expect(normalizeUrl('https://example.com/path/')).toBe('https://example.com/path')
    })

    it('ルートはスラッシュ有無を問わず同一正規形になる', () => {
      expect(normalizeUrl('https://example.com')).toBe('https://example.com/')
      expect(normalizeUrl('https://example.com/')).toBe('https://example.com/')
    })

    it('ハッシュを削除する', () => {
      expect(normalizeUrl('https://example.com/path#section')).toBe('https://example.com/path')
    })

    it('クエリパラメータは保持する', () => {
      expect(normalizeUrl('https://example.com/path?a=1')).toBe('https://example.com/path?a=1')
    })

    it('複数の規則を同時に適用する', () => {
      expect(normalizeUrl('http://www.example.com/path/#x')).toBe('https://example.com/path')
    })

    it('不正な URL は原文を返す', () => {
      expect(normalizeUrl('not a url')).toBe('not a url')
    })
  })
}
