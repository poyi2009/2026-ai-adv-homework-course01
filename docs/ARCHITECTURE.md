# ARCHITECTURE.md

## 目錄結構

```
.
├── server.js                  # 進入點：檢查 JWT_SECRET，監聽 port，export app 給測試用
├── app.js                     # Express 應用設定：middleware、路由掛載、404/error handler
├── swagger-config.js          # swagger-jsdoc 設定（openapi 3.0.3 定義 + securitySchemes）
├── generate-openapi.js        # 讀 swagger-config 產生 openapi.json 的 script
├── vitest.config.js           # 測試設定：fileParallelism=false，固定執行順序
├── database.sqlite            # SQLite 資料庫檔（WAL 模式）
│
├── src/
│   ├── database.js            # 建立 DB 連線、建立 tables（CREATE IF NOT EXISTS）、seed admin + products
│   ├── middleware/
│   │   ├── authMiddleware.js  # 驗證 Bearer JWT，解碼後設定 req.user
│   │   ├── adminMiddleware.js # 檢查 req.user.role === 'admin'，需在 authMiddleware 之後
│   │   ├── sessionMiddleware.js # 讀取 X-Session-Id header，設定 req.sessionId
│   │   └── errorHandler.js   # 全域錯誤 handler，500 隱藏細節，非 500 用安全訊息
│   ├── routes/
│   │   ├── authRoutes.js      # POST /register, POST /login, GET /profile
│   │   ├── productRoutes.js   # GET /products, GET /products/:id（公開）
│   │   ├── cartRoutes.js      # GET/POST/PATCH/DELETE /cart（雙模式認證）
│   │   ├── orderRoutes.js     # POST/GET/PATCH /orders（JWT 必要）
│   │   ├── paymentRoutes.js   # POST /api/payments/ecpay/initiate（JWT）+ /payments/ecpay/result、/notify（無認證）
│   │   ├── adminProductRoutes.js # GET/POST/PUT/DELETE /admin/products（admin only）
│   │   ├── adminOrderRoutes.js   # GET /admin/orders（admin only，唯讀）
│   │   └── pageRoutes.js      # SSR 頁面路由，回傳 EJS render 結果
│   └── services/
│       └── ecpayService.js    # ECPay AIO 工具函式：CheckMacValue 計算、buildAioParams、queryTradeInfo
│
├── views/
│   ├── layouts/
│   │   ├── front.ejs          # 前台 HTML 殼層（含 head、header、footer、pageScript）
│   │   └── admin.ejs          # 後台 HTML 殼層（含 admin sidebar、header）
│   ├── pages/
│   │   ├── index.ejs          # 首頁（商品列表）
│   │   ├── product-detail.ejs # 商品詳情
│   │   ├── cart.ejs           # 購物車
│   │   ├── checkout.ejs       # 結帳
│   │   ├── login.ejs          # 登入 / 註冊
│   │   ├── orders.ejs         # 我的訂單
│   │   ├── order-detail.ejs   # 訂單詳情
│   │   ├── 404.ejs            # 404 頁面
│   │   └── admin/
│   │       ├── products.ejs   # 後台商品管理
│   │       └── orders.ejs     # 後台訂單管理
│   └── partials/
│       ├── head.ejs           # <head> 標籤（meta、CSS link）
│       ├── header.ejs         # 前台導覽列
│       ├── footer.ejs         # 前台頁尾
│       ├── notification.ejs   # Toast 通知元件
│       ├── admin-header.ejs   # 後台頂部導覽
│       └── admin-sidebar.ejs  # 後台側欄
│
├── public/
│   ├── css/
│   │   ├── input.css          # Tailwind @import 來源
│   │   └── output.css         # Build 後的 CSS（勿手改）
│   ├── stylesheets/
│   │   └── style.css          # 自訂補充 CSS
│   └── js/
│       ├── api.js             # 共用 fetch wrapper（自動帶 Authorization header）
│       ├── auth.js            # localStorage token 操作（getToken/setToken/removeToken）
│       ├── header-init.js     # header 動態渲染（登入狀態、角色判斷）
│       ├── notification.js    # Toast 顯示 helper
│       └── pages/             # 各頁面專屬 JS（由 layout 透過 pageScript 動態載入）
│           ├── index.js
│           ├── product-detail.js
│           ├── cart.js
│           ├── checkout.js
│           ├── login.js
│           ├── orders.js
│           ├── order-detail.js
│           ├── admin-products.js
│           └── admin-orders.js
│
└── tests/
    ├── setup.js               # 共用輔助函式（getAdminToken、registerUser）
    ├── auth.test.js
    ├── products.test.js
    ├── cart.test.js
    ├── orders.test.js
    ├── adminProducts.test.js
    └── adminOrders.test.js
```

## 啟動流程

```
node server.js
  ├─ 檢查 JWT_SECRET（缺少則 exit(1)）
  ├─ require('./app')
  │    ├─ dotenv.config()
  │    ├─ require('./src/database')  ← 連線 SQLite，CREATE TABLE IF NOT EXISTS，seed
  │    ├─ Express 實例化
  │    ├─ 設定 view engine = ejs，views 目錄
  │    ├─ express.static('public')
  │    ├─ cors({ origin: FRONTEND_URL || 'http://localhost:3001' })
  │    ├─ express.json() + express.urlencoded()
  │    ├─ sessionMiddleware（讀 X-Session-Id → req.sessionId）
  │    ├─ 掛載 API routes（含 /api/payments → paymentRoutes.apiRouter）
  │    ├─ 掛載 page routes（含 /payments → paymentRoutes.pageRouter）
  │    ├─ 404 handler（API 回 JSON，其他 render 404.ejs）
  │    └─ errorHandler（全域 catch）
  └─ app.listen(PORT)
```

`server.js` 以 `if (require.main === module)` 判斷是否直接執行，確保測試 `require('./app')` 時不啟動 port 監聽。

## API 路由總覽

| 前綴 | 檔案 | 認證 | 說明 |
|------|------|------|------|
| `/api/auth` | authRoutes.js | 部分（profile 需 JWT） | 註冊、登入、個人資料 |
| `/api/products` | productRoutes.js | 無 | 公開商品列表與詳情 |
| `/api/cart` | cartRoutes.js | 雙模式（JWT 或 session） | 購物車 CRUD |
| `/api/orders` | orderRoutes.js | JWT 必要 | 建立訂單、查詢、模擬付款 |
| `/api/payments` | paymentRoutes.js（apiRouter） | JWT 必要 | ECPay 付款發起 |
| `/payments` | paymentRoutes.js（pageRouter） | 無 | ECPay 回調接收（result、notify） |
| `/api/admin/products` | adminProductRoutes.js | JWT + admin role | 後台商品管理 |
| `/api/admin/orders` | adminOrderRoutes.js | JWT + admin role | 後台訂單查閱 |
| `/` | pageRoutes.js | 無（前端 JS 自行處理） | SSR 頁面 |

### 完整 endpoint 清單

| Method | Path | 認證 | 說明 |
|--------|------|------|------|
| POST | /api/auth/register | 無 | 註冊，回傳 user + token |
| POST | /api/auth/login | 無 | 登入，回傳 user + token |
| GET | /api/auth/profile | JWT | 取得登入者資料 |
| GET | /api/products | 無 | 商品列表（分頁） |
| GET | /api/products/:id | 無 | 商品詳情 |
| GET | /api/cart | 雙模式 | 取得購物車內容 |
| POST | /api/cart | 雙模式 | 加入商品（自動累加） |
| PATCH | /api/cart/:itemId | 雙模式 | 修改數量（直接覆蓋） |
| DELETE | /api/cart/:itemId | 雙模式 | 移除項目 |
| POST | /api/orders | JWT | 從購物車建立訂單（transaction） |
| GET | /api/orders | JWT | 我的訂單列表 |
| GET | /api/orders/:id | JWT | 訂單詳情（只能看自己的） |
| PATCH | /api/orders/:id/pay | JWT | 模擬付款（action: success\|fail，僅測試用） |
| POST | /api/payments/ecpay/initiate/:orderId | JWT | ECPay AIO 付款發起，回傳 formAction + params |
| POST | /payments/ecpay/result | 無 | ECPay OrderResultURL 回調，主動驗證並更新 status |
| POST | /payments/ecpay/notify | 無 | ECPay ReturnURL S2S（本機收不到），固定回 1\|OK |
| GET | /api/admin/products | JWT+admin | 後台商品列表（分頁） |
| POST | /api/admin/products | JWT+admin | 新增商品 |
| PUT | /api/admin/products/:id | JWT+admin | 更新商品（partial update） |
| DELETE | /api/admin/products/:id | JWT+admin | 刪除商品（pending 訂單時拒絕） |
| GET | /api/admin/orders | JWT+admin | 後台訂單列表（可篩選 status） |
| GET | /api/admin/orders/:id | JWT+admin | 後台訂單詳情（含 user 資訊） |

## 統一回應格式

所有 API 回應均採以下 JSON 結構：

```json
{
  "data": { ... } | null,
  "error": "ERROR_CODE" | null,
  "message": "人類可讀訊息"
}
```

成功時 `error` 為 `null`；失敗時 `data` 為 `null`，`error` 為大寫底線的錯誤代碼。

### 常用錯誤代碼

| 代碼 | HTTP | 說明 |
|------|------|------|
| `VALIDATION_ERROR` | 400 | 欄位缺失或格式錯誤 |
| `CART_EMPTY` | 400 | 購物車為空（建立訂單時） |
| `STOCK_INSUFFICIENT` | 400 | 庫存不足 |
| `INVALID_STATUS` | 400 | 訂單狀態不允許此操作 |
| `UNAUTHORIZED` | 401 | 未提供 token 或 token 無效/過期 |
| `FORBIDDEN` | 403 | 角色權限不足 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `CONFLICT` | 409 | Email 重複；商品有 pending 訂單無法刪除 |
| `INTERNAL_ERROR` | 500 | 伺服器內部錯誤（不洩漏細節） |

## 認證與授權機制

### 標準 JWT 認證（authMiddleware）

1. 讀取 `Authorization: Bearer <token>` header
2. 以 `jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })` 驗證
3. 再查 DB 確認使用者仍存在（防止刪帳後仍可用舊 token）
4. 設定 `req.user = { userId, email, role }`
5. 任何環節失敗 → 401

### Admin 授權（adminMiddleware）

必須在 `authMiddleware` 之後串聯：
- 檢查 `req.user.role === 'admin'`，否則 → 403

### 購物車雙模式認證（dualAuth，僅 cartRoutes）

流程如下：

```
有 Authorization header?
  是 → jwt.verify
        成功 → req.user 設定，next()
        失敗 → 立即回 401（不 fallback）
  否 → 有 req.sessionId?
        是 → next()（訪客模式）
        否 → 401
```

### JWT 參數

- 演算法：HS256
- Payload：`{ userId, email, role }`
- 有效期：7 天
- Secret：來自 `process.env.JWT_SECRET`

## 資料庫 Schema

資料庫檔案：`database.sqlite`（WAL 模式，啟用 foreign_keys）

### users

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| email | TEXT | UNIQUE NOT NULL | 登入 Email |
| password_hash | TEXT | NOT NULL | bcrypt hash |
| name | TEXT | NOT NULL | 顯示名稱 |
| role | TEXT | NOT NULL, DEFAULT 'user', CHECK IN ('user','admin') | 角色 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

### products

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| name | TEXT | NOT NULL | 商品名稱 |
| description | TEXT | — | 商品描述 |
| price | INTEGER | NOT NULL, CHECK(price > 0) | 售價（新台幣整數） |
| stock | INTEGER | NOT NULL, DEFAULT 0, CHECK(stock >= 0) | 庫存數量 |
| image_url | TEXT | — | 商品圖片 URL |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |
| updated_at | TEXT | NOT NULL, DEFAULT datetime('now') | 更新時間（PUT 時手動更新） |

### cart_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| session_id | TEXT | — | 訪客 session ID（與 user_id 二擇一） |
| user_id | TEXT | FK → users(id) | 會員 ID（與 session_id 二擇一） |
| product_id | TEXT | NOT NULL, FK → products(id) | 商品 ID |
| quantity | INTEGER | NOT NULL, DEFAULT 1, CHECK(quantity > 0) | 數量 |

注意：`session_id` 和 `user_id` 無 DB 層面的互斥約束，由業務邏輯（`getOwnerCondition`）保證只設其一。

### orders

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_no | TEXT | UNIQUE NOT NULL | 格式 `ORD-YYYYMMDD-XXXXX` |
| user_id | TEXT | NOT NULL, FK → users(id) | 下單使用者 |
| recipient_name | TEXT | NOT NULL | 收件人姓名 |
| recipient_email | TEXT | NOT NULL | 收件人 Email |
| recipient_address | TEXT | NOT NULL | 收件地址 |
| total_amount | INTEGER | NOT NULL | 訂單總金額 |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','paid','failed') | 訂單狀態 |
| merchant_trade_no | TEXT | UNIQUE（新建 DB）/ 無約束（migration） | ECPay 流水號，格式 `EC` + 13 位時間戳 + 7 位隨機英數，付款前生成 |
| created_at | TEXT | NOT NULL, DEFAULT datetime('now') | 建立時間 |

### order_items

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | TEXT | PRIMARY KEY | UUID v4 |
| order_id | TEXT | NOT NULL, FK → orders(id) | 所屬訂單 |
| product_id | TEXT | NOT NULL | 商品 ID（快照，不走 FK） |
| product_name | TEXT | NOT NULL | 下單時的商品名稱快照 |
| product_price | INTEGER | NOT NULL | 下單時的商品價格快照 |
| quantity | INTEGER | NOT NULL | 數量 |

`product_name` 和 `product_price` 是快照欄位，即使商品後續被修改或刪除，歷史訂單仍保有正確資料。

## 前端架構（MPA）

每個頁面 EJS 渲染後，透過 layout 動態載入 `pageScript` 對應的 JS 檔：

```
/public/js/pages/<pageScript>.js
```

例如首頁 `pageScript: 'index'` → 載入 `/public/js/pages/index.js`。

共用 JS 模組：
- `api.js`：封裝 `fetch`，自動從 `localStorage` 帶入 JWT token
- `auth.js`：`getToken()` / `setToken(token)` / `removeToken()` 操作 localStorage
- `header-init.js`：根據 token 狀態渲染登入/登出按鈕與管理員選項
- `notification.js`：顯示 toast 通知
