# CHANGELOG.md

## [1.0.0] - 2026-06-14

### 新增

- 使用者認證：註冊、登入、JWT 憑證（7d 有效期、HS256）
- 商品公開 API：列表（分頁）、詳情
- 購物車 API：支援訪客（X-Session-Id）與會員（JWT）雙模式
- 訂單 API：建立（DB transaction，原子扣庫存）、列表、詳情、模擬付款
- 後台商品管理 API：CRUD（刪除有 pending 訂單時拒絕）
- 後台訂單查閱 API：列表（可篩 status）、詳情（含使用者資訊）
- EJS SSR 頁面：前台（首頁、商品詳情、購物車、結帳、登入、訂單）、後台（商品管理、訂單管理）
- Tailwind CSS 4 前端樣式
- Vitest + supertest 整合測試（6 個測試檔，固定執行順序）
- swagger-jsdoc OpenAPI 3.0.3 文件產生（`npm run openapi`）
- SQLite WAL 模式 + 外鍵約束
- Seed 資料：admin 帳號、8 筆花卉商品
