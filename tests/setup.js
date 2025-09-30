/**
 * Jest セットアップファイル
 * Chrome API のモックを設定
 */

// Chrome API のモック
global.chrome = {
  bookmarks: {
    getTree: jest.fn(),
    onCreated: {
      addListener: jest.fn(),
    },
    onRemoved: {
      addListener: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
    onMoved: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    onCreated: {
      addListener: jest.fn(),
    },
    onUpdated: {
      addListener: jest.fn(),
    },
  },
  windows: {
    update: jest.fn(),
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  runtime: {
    onInstalled: {
      addListener: jest.fn(),
    },
  },
};

// performance API のモック
global.performance = {
  now: jest.fn(() => Date.now()),
};

// コンソールのモック（テスト中のログ出力を抑制）
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
