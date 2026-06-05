import './App.css'
import { createSignal, onCleanup, onMount } from 'solid-js'
import { DEFAULT_STATISTICS } from '@/lib/settings/types'
import type { Statistics } from '@/lib/settings/types'
import { enabledItem } from '@/lib/settings/enabledItem'
import { formatRelativeTime } from '@/lib/time/formatRelativeTime'
import { resetStatistics } from '@/lib/settings/resetStatistics'
import { statisticsItem } from '@/lib/settings/statisticsItem'

function App() {
	const [enabled, setEnabled] = createSignal(true)
	const [statistics, setStatistics] = createSignal<Statistics>(DEFAULT_STATISTICS)

	// watch 登録と onCleanup は await 前に同期的に行い reactive owner を保つ
	const unwatchEnabled = enabledItem.watch((value) => setEnabled(value))
	const unwatchStatistics = statisticsItem.watch((value) => setStatistics(value))
	onCleanup(() => {
		unwatchEnabled()
		unwatchStatistics()
	})

	onMount(async () => {
		setEnabled(await enabledItem.getValue())
		setStatistics(await statisticsItem.getValue())
	})

	const handleToggle = async (next: boolean) => {
		setEnabled(next) // 楽観更新
		try {
			await enabledItem.setValue(next)
		} catch {
			// 失敗時は実値で signal を戻す（checkbox は signal にバインドされ再描画される）
			setEnabled(await enabledItem.getValue())
			alert('設定の更新に失敗しました')
		}
	}

	const handleReset = async () => {
		if (!confirm('統計情報をリセットしますか?')) {
			return
		}
		try {
			await resetStatistics()
		} catch {
			alert('統計情報のリセットに失敗しました')
		}
	}

	// lastMergeTime（string | null）を相対表現へ。null / 不正値は '-'
	const lastMergeLabel = () => {
		const value = statistics().lastMergeTime
		if (value === null) {
			return '-'
		}
		const date = new Date(value)
		if (Number.isNaN(date.getTime())) {
			return '-'
		}
		return formatRelativeTime(date, new Date())
	}

	return (
		<div class="container">
			<header>
				<h1>UniqueTab</h1>
				<p class="subtitle">タブの重複を防止</p>
			</header>

			<main>
				<div class="setting-item">
					<div class="setting-info">
						<h2>拡張機能を有効化</h2>
						<p class="description">ピン留めされたタブの URL 重複を防ぎます</p>
					</div>
					<label class="toggle-switch">
						<input
							type="checkbox"
							checked={enabled()}
							onChange={(event) => void handleToggle(event.currentTarget.checked)}
						/>
						<span class="slider" />
					</label>
				</div>

				<div class="divider" />

				<div class="statistics">
					<h3>統計情報</h3>
					<div class="stat-item">
						<span class="stat-label">統合されたタブ数:</span>
						<span class="stat-value">{statistics().mergedTabs}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">最終統合時刻:</span>
						<span class="stat-value">{lastMergeLabel()}</span>
					</div>
					<button class="reset-btn" type="button" onClick={() => void handleReset()}>
						統計をリセット
					</button>
				</div>
			</main>

			<footer>
				<p class="version">Version 2.0.0</p>
			</footer>
		</div>
	)
}

export default App
