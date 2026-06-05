/** 1 分（ミリ秒） */
const MINUTE_MS = 60_000
/** 1 時間（ミリ秒） */
const HOUR_MS = 3_600_000
/** 1 日（ミリ秒） */
const DAY_MS = 86_400_000

/**
 * 基準時刻からの相対表現を日本語で返す。
 *
 * - 1 分未満: `たった今`
 * - 1 時間未満: `N分前`
 * - 24 時間未満: `N時間前`
 * - 7 日未満: `N日前`
 * - それ以上: 絶対日時（`ja-JP` ロケール）
 *
 * `now` を引数注入することで決定論的にテストできる。
 *
 * @param target 対象の時刻
 * @param now 基準となる現在時刻
 * @returns 相対時間の文字列
 */
export function formatRelativeTime(target: Date, now: Date): string {
	const diffMs = now.getTime() - target.getTime()
	const diffMins = Math.floor(diffMs / MINUTE_MS)
	const diffHours = Math.floor(diffMs / HOUR_MS)
	const diffDays = Math.floor(diffMs / DAY_MS)

	if (diffMins < 1) {
		return 'たった今'
	}
	if (diffMins < 60) {
		return `${diffMins}分前`
	}
	if (diffHours < 24) {
		return `${diffHours}時間前`
	}
	if (diffDays < 7) {
		return `${diffDays}日前`
	}
	return target.toLocaleDateString('ja-JP', {
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		month: '2-digit',
		year: 'numeric',
	})
}

if (import.meta.vitest) {
	const { describe, expect, it } = import.meta.vitest
	describe('formatRelativeTime', () => {
		const now = new Date('2026-06-05T12:00:00Z')

		it('1 分未満は「たった今」', () => {
			expect(formatRelativeTime(new Date('2026-06-05T11:59:30Z'), now)).toBe('たった今')
		})

		it('1 分以上 1 時間未満は「N分前」', () => {
			expect(formatRelativeTime(new Date('2026-06-05T11:30:00Z'), now)).toBe('30分前')
		})

		it('境界: ちょうど 1 分前は「1分前」', () => {
			expect(formatRelativeTime(new Date('2026-06-05T11:59:00Z'), now)).toBe('1分前')
		})

		it('1 時間以上 24 時間未満は「N時間前」', () => {
			expect(formatRelativeTime(new Date('2026-06-05T09:00:00Z'), now)).toBe('3時間前')
		})

		it('境界: ちょうど 60 分前は「1時間前」', () => {
			expect(formatRelativeTime(new Date('2026-06-05T11:00:00Z'), now)).toBe('1時間前')
		})

		it('24 時間以上 7 日未満は「N日前」', () => {
			expect(formatRelativeTime(new Date('2026-06-02T12:00:00Z'), now)).toBe('3日前')
		})

		it('7 日以上は絶対日時を返す', () => {
			const result = formatRelativeTime(new Date('2026-05-20T12:00:00Z'), now)
			expect(result).not.toBe('たった今')
			expect(result).toMatch(/2026/)
		})
	})
}
