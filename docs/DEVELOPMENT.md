# DEVELOPMENT.md

## 模組系統

專案使用 **CommonJS（require / module.exports）**，`vitest.config.js` 除外（使用 ESM `import`）。  
不可在 `src/` 或 `tests/` 使用 `import`/`export`。

## 命名規則

| 項目 | 規則 | 範例 |
|------|------|------|
| 檔案（路由） | camelCase + Routes | `cartRoutes.js` |
| 檔案（middleware） | camelCase + Middleware | `authMiddleware.js` |
| 檔案（前端 page JS） | kebab-case | `product-detail.js` |
| DB 欄位 | snake_case | `order_no`, `recipient_name` |
| API request body | camelCase | `productId`, `recipientName` |
| API response body | snake_case（與 DB 欄位一致） | `product_id`, `total_amount` |
| 錯誤代碼 | UPPER_SNAKE_CASE | `VALIDATION_ERROR`, `NOT_FOUND` |
| JWT payload 欄位 | camelCase | `userId`, `email`, `role` |

## 環境變數

檔案位置：`.env`（參考 `.env.example`）

| 變數 | 用途 | 必要性 | 預設值 |
|------|------|--------|--------|
| `JWT_SECRET` | JWT 簽發/驗證 secret | **必要**（缺少則 exit） | — |
| `PORT` | Server 監聽 port | 選填 | `3001` |
| `BASE_URL` | 自身基底 URL | 選填 | `http://localhost:3001` |
| `FRONTEND_URL` | CORS origin 白名單 | 選填 | `http://localhost:3001` |
| `ADMIN_EMAIL` | Seed 管理員帳號 Email | 選填 | `admin@hexschool.com` |
| `ADMIN_PASSWORD` | Seed 管理員密碼 | 選填 | `12345678` |
| `ECPAY_MERCHANT_ID` | 綠界商店代號 | 選填（金流整合） | `3002607` |
| `ECPAY_HASH_KEY` | 綠界 HashKey | 選填（金流整合） | — |
| `ECPAY_HASH_IV` | 綠界 HashIV | 選填（金流整合） | — |
| `ECPAY_ENV` | 金流環境 | 選填 | `staging` |
| `NODE_ENV` | 執行環境 | 選填 | — |

`NODE_ENV=test` 時 bcrypt salt rounds 降為 1，大幅加速測試。

## 新增 API Route 的步驟

1. **建立或選擇 route 檔案**：`src/routes/<feature>Routes.js`
2. **在 `app.js` 掛載**：`app.use('/api/<feature>', require('./src/routes/<feature>Routes'));`
3. **撰寫 handler**：使用統一回應格式 `{ data, error, message }`
4. **加上 JSDoc OpenAPI 標注**（見下方範例）
5. **新增測試**：`tests/<feature>.test.js`，並加入 `vitest.config.js` sequence

## 新增 Middleware 的步驟

1. 建立 `src/middleware/<name>Middleware.js`，export 一個 `(req, res, next)` function
2. 在 `app.js`（全域）或路由檔案（局部）中 `use()`
3. 認證類 middleware 一律在 `authMiddleware` 之後串聯（需要 `req.user`）

## 新增資料表的步驟

1. 在 `src/database.js` 的 `db.exec(...)` 中新增 `CREATE TABLE IF NOT EXISTS`
2. 若需要初始資料，新增對應的 seed function 並在 `initializeDatabase()` 呼叫
3. 外鍵在 `FOREIGN KEY` 子句宣告（`foreign_keys = ON` 已啟用）

## JSDoc OpenAPI 格式

所有 API handler 上方加 `@openapi` 標注，`swagger-jsdoc` 會掃描 `./src/routes/*.js`：

```javascript
/**
 * @openapi
 * /api/feature:
 *   post:
 *     summary: 功能說明
 *     tags: [TagName]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [field1]
 *             properties:
 *               field1:
 *                 type: string
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: object
 *                 error:
 *                   type: string
 *                   nullable: true
 *                 message:
 *                   type: string
 *       400:
 *         description: 驗證失敗
 */
```

安全性方案在 `swagger-config.js` 定義：
- `bearerAuth`：HTTP Bearer JWT
- `sessionId`：API Key，header 名 `X-Session-Id`

## 計畫歸檔流程

1. **計畫檔案命名格式**：`YYYY-MM-DD-<feature-name>.md`
2. **計畫文件結構**：
   ```markdown
   # Feature Name
   ## User Story
   ## Spec（API 端點、欄位、行為）
   ## Tasks
   - [ ] Task 1
   - [x] Task 2（完成打勾）
   ```
3. **功能完成後**：移至 `docs/plans/archive/`
4. **更新 `docs/FEATURES.md`**：將功能狀態改為完成，補充完成日期
5. **更新 `docs/CHANGELOG.md`**：依版本或日期新增一筆記錄

## 前端 JS 新增頁面腳本

1. 在 `public/js/pages/` 新增 `<page-name>.js`
2. 在 `pageRoutes.js` 對應的路由 locals 中設定 `pageScript: '<page-name>'`
3. Layout 會自動載入 `/public/js/pages/<pageScript>.js`
