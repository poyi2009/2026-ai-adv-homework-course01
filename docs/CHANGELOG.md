# CHANGELOG.md

## [Unreleased]

### 新增

- **ECPay AIO 金流串接**：整合綠界科技全方位金流（CMV-SHA256），取代模擬付款按鈕
  - `src/services/ecpayService.js`：`ecpayUrlEncode`、`generateCheckMacValue`、`buildAioParams`、`queryTradeInfo`
  - `src/routes/paymentRoutes.js`：`POST /api/payments/ecpay/initiate/:orderId`（JWT）、`POST /payments/ecpay/result`、`POST /payments/ecpay/notify`
  - 支援 `ECPAY_ENV=staging/production` 切換端點（預設 staging）
  - 支援 `BASE_URL` 環境變數設定回調 URL

### 修復

- **ECPay 錯誤 10300028（訂單編號重覆）**：`initiate` 端點改為每次都產生全新的 `MerchantTradeNo` 並覆寫 DB，不再沿用舊值；ECPay 規定已送出的流水號即使付款未完成也不可重複使用

### 變更

- `orders` 資料表新增 `merchant_trade_no TEXT UNIQUE` 欄位（DB migration 自動補欄位）
- 訂單詳情頁（`/orders/:id`）移除假付款按鈕，改為「前往 ECPay 付款」按鈕
- 付款結果驗證改由後端主動呼叫 QueryTradeInfo API（瀏覽器 redirect 觸發），不依賴 S2S ReturnURL

### 必要環境變數（新增）

| 變數 | 說明 |
|------|------|
| `ECPAY_MERCHANT_ID` | 綠界商店代號 |
| `ECPAY_HASH_KEY` | AIO HashKey |
| `ECPAY_HASH_IV` | AIO HashIV |
| `ECPAY_ENV` | `staging`（預設）或 `production` |
| `BASE_URL` | 伺服器對外 URL（預設 `http://localhost:3001`） |

---

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
