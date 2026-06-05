/** 直列実行キュー: task を順番に実行し、結果 Promise を返す */
export type SerialQueue = (task: () => Promise<void>) => Promise<void>

/**
 * task を直前の task に chain して直列実行するキューのファクトリ。
 *
 * 統計更新の lost update を防ぐ。1 件の task が reject しても内部チェーンは
 * 失敗を握って継続するため後続が止まらない。呼び出し元には個別 task の結果 Promise を返す。
 *
 * @returns task を受け取り直列実行する関数
 */
export function createSerialQueue(): SerialQueue {
	// 内部チェーン（失敗を握って継続するため task の結果とは分離する）
	let tail: Promise<void> = Promise.resolve()

	return (task) => {
		const result = tail.then(task)
		// 内部チェーンは成功・失敗どちらでも次に進む
		tail = result.then(
			() => {},
			() => {},
		)
		// 呼び出し元には個別 task の結果を返す
		return result
	}
}

if (import.meta.vitest) {
	const { describe, expect, it } = import.meta.vitest
	describe('createSerialQueue', () => {
		it('task を直列に実行する（並行に重ならない）', async () => {
			const queue = createSerialQueue()
			const events: string[] = []
			const make = (label: string) => async () => {
				events.push(`${label}:start`)
				await new Promise((resolve) => setTimeout(resolve, 5))
				events.push(`${label}:end`)
			}
			await Promise.all([queue(make('a')), queue(make('b'))])
			expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
		})

		it('lost update を防ぐ: 2 件の read-modify-write が直列化される', async () => {
			const queue = createSerialQueue()
			const store = { value: 0 }
			const increment = async () => {
				const current = store.value
				await new Promise((resolve) => setTimeout(resolve, 5))
				store.value = current + 1
			}
			await Promise.all([queue(increment), queue(increment)])
			expect(store.value).toBe(2)
		})

		it('task が reject しても後続は実行される', async () => {
			const queue = createSerialQueue()
			let secondRan = false
			const failing = queue(() => Promise.reject(new Error('boom')))
			const second = queue(async () => {
				secondRan = true
			})
			await expect(failing).rejects.toThrow('boom')
			await second
			expect(secondRan).toBe(true)
		})
	})
}
