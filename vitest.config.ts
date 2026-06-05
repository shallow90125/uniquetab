import { configDefaults, defineConfig } from 'vitest/config'
import { WxtVitest } from 'wxt/testing/vitest-plugin'

export default defineConfig({
	plugins: [WxtVitest()],
	test: {
		environment: 'happy-dom',
		// v1（旧 Vanilla JS / jest ベース）はテスト対象外
		exclude: [...configDefaults.exclude, 'v1/**'],
		globals: true,
		includeSource: ['lib/**/*.ts'],
		pool: 'forks',
		setupFiles: ['./tests/setup.ts'],
	},
})
