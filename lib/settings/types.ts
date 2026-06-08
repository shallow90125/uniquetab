/** 統合の統計情報。`lastMergeTime` は ISO 8601 文字列、未統合なら null */
export type Statistics = {
  lastMergeTime: string | null
  mergedTabs: number
}

/** 統計情報の初期値（v1 互換） */
export const DEFAULT_STATISTICS: Statistics = {
  lastMergeTime: null,
  mergedTabs: 0,
}
