/**
 * BookmarkService のテスト
 */

// テスト用のモジュール読み込み
const fs = require("fs");
const path = require("path");

// BookmarkService のコードを読み込む
const bookmarkServiceCode = fs.readFileSync(
  path.join(__dirname, "../services/BookmarkService.js"),
  "utf8"
);

describe("BookmarkService", () => {
  let BookmarkService;
  let bookmarkService;
  let Logger;

  beforeEach(() => {
    // Chrome API モックのリセット
    jest.clearAllMocks();

    // Logger のモック
    Logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    global.Logger = Logger;

    // BookmarkService クラスを評価
    eval(bookmarkServiceCode);
    bookmarkService = new BookmarkService();
  });

  describe("initialize", () => {
    it("初期化時にブックマークツリーを取得してキャッシュを構築する", async () => {
      const mockTree = [
        {
          id: "1",
          title: "Bookmarks Bar",
          children: [
            {
              id: "2",
              title: "Google",
              url: "https://www.google.com",
            },
            {
              id: "3",
              title: "GitHub",
              url: "https://github.com",
            },
          ],
        },
      ];

      chrome.bookmarks.getTree.mockResolvedValue(mockTree);

      await bookmarkService.initialize();

      expect(chrome.bookmarks.getTree).toHaveBeenCalled();
      expect(bookmarkService.cacheInitialized).toBe(true);
      expect(bookmarkService.bookmarkCache.size).toBe(2);
      expect(Logger.info).toHaveBeenCalledWith("BookmarkService initialized");
    });

    it("初期化エラー時はエラーログを出力する", async () => {
      const error = new Error("API Error");
      chrome.bookmarks.getTree.mockRejectedValue(error);

      await bookmarkService.initialize();

      expect(Logger.error).toHaveBeenCalledWith(
        "Failed to initialize BookmarkService",
        error
      );
    });
  });

  describe("isUrlBookmarked", () => {
    beforeEach(async () => {
      const mockTree = [
        {
          children: [
            { id: "1", title: "Test", url: "https://example.com" },
            { id: "2", title: "Test2", url: "https://test.com" },
          ],
        },
      ];
      chrome.bookmarks.getTree.mockResolvedValue(mockTree);
      await bookmarkService.initialize();
    });

    it("ブックマークに登録されているURLの場合はtrueを返す", async () => {
      const result = await bookmarkService.isUrlBookmarked(
        "https://example.com"
      );
      expect(result).toBe(true);
    });

    it("ブックマークに登録されていないURLの場合はfalseを返す", async () => {
      const result = await bookmarkService.isUrlBookmarked(
        "https://notbookmarked.com"
      );
      expect(result).toBe(false);
    });

    it("内部URLの場合はfalseを返す", async () => {
      const result = await bookmarkService.isUrlBookmarked("chrome://settings");
      expect(result).toBe(false);
    });

    it("URLがnullの場合はfalseを返す", async () => {
      const result = await bookmarkService.isUrlBookmarked(null);
      expect(result).toBe(false);
    });
  });

  describe("isInternalUrl", () => {
    it("chrome://で始まるURLはtrueを返す", () => {
      expect(bookmarkService.isInternalUrl("chrome://settings")).toBe(true);
    });

    it("about:で始まるURLはtrueを返す", () => {
      expect(bookmarkService.isInternalUrl("about:blank")).toBe(true);
    });

    it("通常のURLはfalseを返す", () => {
      expect(bookmarkService.isInternalUrl("https://example.com")).toBe(false);
    });
  });

  describe("traverseBookmarkTree", () => {
    it("ネストされたブックマークツリーを正しく走査する", () => {
      bookmarkService.bookmarkCache.clear();

      const tree = [
        {
          children: [
            {
              id: "1",
              title: "Folder",
              children: [
                { id: "2", title: "Link1", url: "https://link1.com" },
                { id: "3", title: "Link2", url: "https://link2.com" },
              ],
            },
            { id: "4", title: "Link3", url: "https://link3.com" },
          ],
        },
      ];

      bookmarkService.traverseBookmarkTree(tree);

      expect(bookmarkService.bookmarkCache.size).toBe(3);
      expect(bookmarkService.bookmarkCache.has("https://link1.com")).toBe(true);
      expect(bookmarkService.bookmarkCache.has("https://link2.com")).toBe(true);
      expect(bookmarkService.bookmarkCache.has("https://link3.com")).toBe(true);
    });
  });

  describe("getBookmarkInfo", () => {
    beforeEach(async () => {
      const mockTree = [
        {
          children: [{ id: "1", title: "Example", url: "https://example.com" }],
        },
      ];
      chrome.bookmarks.getTree.mockResolvedValue(mockTree);
      await bookmarkService.initialize();
    });

    it("ブックマーク情報を返す", async () => {
      const info = await bookmarkService.getBookmarkInfo("https://example.com");
      expect(info).toEqual({
        id: "1",
        title: "Example",
        url: "https://example.com",
      });
    });

    it("存在しないURLの場合はnullを返す", async () => {
      const info = await bookmarkService.getBookmarkInfo(
        "https://notexist.com"
      );
      expect(info).toBeNull();
    });
  });
});
