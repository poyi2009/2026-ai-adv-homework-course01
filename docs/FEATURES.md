# FEATURES.md

## 功能完成狀態

| 功能區塊 | 狀態 |
|---------|------|
| 使用者認證 | 完成 |
| 商品瀏覽（公開） | 完成 |
| 購物車（訪客 + 會員） | 完成 |
| 訂單建立與查詢 | 完成 |
| ECPay AIO 金流串接 | 完成 |
| 後台商品管理 | 完成 |
| 後台訂單查閱 | 完成 |
| 前台 SSR 頁面 | 完成 |
| OpenAPI 文件產生 | 完成 |

---

## 使用者認證

### POST /api/auth/register

**行為描述**：建立新使用者帳號，成功後立即回傳 JWT token（不需另行登入）。

必填欄位：`email`、`password`（最少 6 字元）、`name`

驗證邏輯：
- Email 格式以 regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` 驗證
- Email 已存在 → 409 CONFLICT
- 任一必填欄位缺失 → 400 VALIDATION_ERROR

成功回應（201）：
```json
{
  "data": {
    "user": { "id": "uuid", "email": "...", "name": "...", "role": "user" },
    "token": "JWT"
  },
  "error": null,
  "message": "註冊成功"
}
```

### POST /api/auth/login

**行為描述**：以 Email + 密碼登入，回傳 JWT token。Email 不存在與密碼錯誤均回傳相同錯誤訊息（防止帳號列舉）。

必填欄位：`email`、`password`

錯誤情境：
- 欄位缺失 → 400
- Email 不存在或密碼錯誤 → 401（統一回 "Email 或密碼錯誤"）

### GET /api/auth/profile

**行為描述**：取得目前登入使用者的完整資料。需要 `Authorization: Bearer <token>`。

成功回應包含：`id`、`email`、`name`、`role`、`created_at`

---

## 商品瀏覽

### GET /api/products

**行為描述**：公開商品列表，支援分頁。預設第 1 頁、每頁 10 筆，最多 100 筆/頁。不驗證身份。

查詢參數：

| 參數 | 型別 | 預設值 | 限制 |
|------|------|--------|------|
| `page` | integer | 1 | 最小 1 |
| `limit` | integer | 10 | 1–100 |

回應包含 `data.products`（陣列）和 `data.pagination`（`total`, `page`, `limit`, `totalPages`）。

商品依 `created_at DESC` 排序。

### GET /api/products/:id

**行為描述**：取得單一商品完整資料。商品不存在回 404 NOT_FOUND。

---

## 購物車（雙模式認證）

購物車支援兩種身份模式，**同一 cart_items 表**，以不同欄位識別擁有者：

| 模式 | Header | DB 欄位 |
|------|--------|---------|
| 訪客 | `X-Session-Id: <uuid>` | `session_id` |
| 會員 | `Authorization: Bearer <token>` | `user_id` |

**重要**：若 `Authorization` header 存在但 token 無效，直接回 401，**不 fallback 到 session**。

### GET /api/cart

**行為描述**：取得當前身份的購物車，JOIN products 取得商品資訊，並計算 `total` 金額。

回應包含 `data.items`（陣列，每項含 `id`, `product_id`, `quantity`, `product{name, price, stock, image_url}`）和 `data.total`（整數）。

### POST /api/cart

**行為描述**：將商品加入購物車。若同商品已在購物車，**累加數量**（非覆蓋）。累加後的數量超過庫存時拒絕。

必填欄位：`productId`，選填：`quantity`（預設 1）

```
已在購物車？
  是 → new_qty = existing.quantity + request.quantity
        new_qty > stock → 400 STOCK_INSUFFICIENT
        更新數量
  否 → quantity > stock → 400 STOCK_INSUFFICIENT
        INSERT 新項目
```

### PATCH /api/cart/:itemId

**行為描述**：直接將數量**覆蓋**為指定值（與 POST 的累加不同）。只能操作自己的 cart item（query 時加上 owner condition）。

必填：`quantity`（正整數）

### DELETE /api/cart/:itemId

**行為描述**：移除購物車項目。同樣驗證 owner，避免跨使用者刪除。

---

## 訂單建立與查詢

所有 `/api/orders` 路由均需要 JWT 認證（僅支援會員）。

### POST /api/orders

**行為描述**：從購物車建立訂單。整個流程包在一個 SQLite transaction 中，確保原子性。

必填欄位：`recipientName`、`recipientEmail`（格式驗證）、`recipientAddress`

Transaction 步驟：
1. INSERT 訂單（order_no 格式：`ORD-YYYYMMDD-<5字UUID大寫>`）
2. INSERT 每個 order_item（快照 `product_name`、`product_price`）
3. UPDATE products.stock 扣庫存（`stock = stock - quantity`）
4. DELETE 使用者的所有 cart_items（清空購物車）

前置驗證（transaction 前）：
- 購物車為空 → 400 CART_EMPTY
- 任一商品庫存不足 → 400 STOCK_INSUFFICIENT（列出所有不足商品名稱）

成功回傳：`id`、`order_no`、`total_amount`、`status: "pending"`、`items`、`created_at`

### GET /api/orders

**行為描述**：取得目前登入使用者的所有訂單，依 `created_at DESC` 排序（不含 order_items）。

### GET /api/orders/:id

**行為描述**：取得單一訂單詳情（含 order_items）。強制過濾 `user_id = req.user.userId`，使用者只能查看自己的訂單。

### PATCH /api/orders/:id/pay（已由 ECPay 流程取代）

**行為描述**：模擬付款端點（僅供測試用），直接更新訂單狀態，不呼叫真實金流。前台 UI 已移除對應按鈕，改用 ECPay 付款流程。

必填：`action`（`"success"` → `"paid"` 或 `"fail"` → `"failed"`）

錯誤情境：
- `action` 非 success/fail → 400 VALIDATION_ERROR
- 訂單不存在（或非本人）→ 404
- 訂單 status 非 pending → 400 INVALID_STATUS

---

## ECPay AIO 金流串接

整合綠界科技全方位金流（AIO，CMV-SHA256），讓消費者從訂單詳情頁跳轉至 ECPay 付款頁完成交易。由於伺服器運行於本機，ReturnURL S2S 通知無法觸及，**付款驗證改為 OrderResultURL redirect 回來時，後端主動呼叫 QueryTradeInfo API 核實**。

### 付款流程

```
[訂單詳情頁] 「前往 ECPay 付款」按鈕（status = 'pending' 才顯示）
     ↓ POST /api/payments/ecpay/initiate/:orderId（JWT 認證）
[後端] 生成 MerchantTradeNo，儲存至 DB，計算 CheckMacValue
     ↓ 回傳 { formAction, params }
[前端] 動態建立 <form>，auto-submit 到 ECPay 付款頁
     ↓
[消費者在 ECPay 付款]
     ↓ 瀏覽器 POST redirect 到 /payments/ecpay/result
[後端] 查 DB 取訂單 → 呼叫 QueryTradeInfo → 更新 status
     ↓ 302 redirect 到 /orders/:id?payment=success（或 ?payment=failed）
[訂單詳情頁] 偵測 ?payment query → 顯示付款成功/失敗通知
```

### POST /api/payments/ecpay/initiate/:orderId

**認證**：JWT 必要（只能操作自己的訂單）

**行為描述**：為指定訂單建立 ECPay AIO 付款參數。

前置驗證：
- 訂單不屬於目前登入者 → 404 NOT_FOUND
- 訂單 `status` 非 `pending` → 400 INVALID_STATUS

核心邏輯：
1. 若訂單已有 `merchant_trade_no`（重複提交），沿用既有值，不重新生成
2. 新訂單生成格式：`EC` + 13 位時間戳 + 7 位隨機英數大寫，取前 20 字
3. 呼叫 `ecpayService.buildAioParams()` 組裝完整 AIO 參數（含 CheckMacValue）

成功回應（200）：
```json
{
  "data": {
    "formAction": "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
    "params": { "MerchantID": "...", "MerchantTradeNo": "...", "CheckMacValue": "...", ... }
  },
  "error": null,
  "message": "付款資訊建立成功"
}
```

前端收到後，動態建立隱藏 `<form>` 並自動 submit 至 `formAction`。

### POST /payments/ecpay/result

**認證**：無（ECPay 瀏覽器 redirect，不帶 JWT）

**行為描述**：ECPay `OrderResultURL` 的接收端點，處理付款結果。

流程：
1. 讀取 `req.body.MerchantTradeNo`，查 DB 找對應訂單
2. 若訂單 `status` 非 `pending`（已處理過），直接依現有狀態 redirect（冪等）
3. 呼叫 `ecpayService.queryTradeInfo()` 主動查詢 ECPay 付款結果
4. `TradeStatus === '1'` → 更新 `status = 'paid'`，否則 → `status = 'failed'`
5. 302 redirect 到 `/orders/:id?payment=success` 或 `?payment=failed`

異常處理：
- `MerchantTradeNo` 缺失 → redirect 到 `/?payment=failed`
- QueryTradeInfo 網路錯誤 → redirect 到 `/orders/:id?payment=failed`

### POST /payments/ecpay/notify

**認證**：無（ECPay ReturnURL S2S，本機環境收不到）

**行為描述**：固定回應 `1|OK`，防止 ECPay 重試 S2S 通知報錯。

---

## 後台商品管理（Admin Only）

所有路由需要 JWT + role=admin，否則分別回 401 / 403。

### GET /api/admin/products

**行為描述**：與公開商品列表相同邏輯（分頁），差異在於需要 admin 認證。

### POST /api/admin/products

必填：`name`、`price`（正整數）、`stock`（非負整數）  
選填：`description`、`image_url`

### PUT /api/admin/products/:id

**行為描述**：部分更新（partial update）。只更新 body 中提供的欄位，未提供的保持原值。`updated_at` 手動更新為 `datetime('now')`。

各欄位驗證：
- `name`：不可為空字串
- `price`：若提供，必須為正整數
- `stock`：若提供，必須為非負整數

### DELETE /api/admin/products/:id

**行為描述**：刪除商品。若商品存在於任何 `status = 'pending'` 的訂單中，拒絕刪除。

```
SELECT COUNT(*) FROM order_items oi
JOIN orders o ON oi.order_id = o.id
WHERE oi.product_id = ? AND o.status = 'pending'
→ count > 0 → 409 CONFLICT
```

---

## 後台訂單查閱（Admin Only）

### GET /api/admin/orders

**行為描述**：查詢所有使用者的訂單，支援分頁及 `status` 篩選。

查詢參數：

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `page` | integer | 1 | 頁碼 |
| `limit` | integer | 10 | 每頁筆數（最多 100） |
| `status` | string | — | 篩選 pending\|paid\|failed，不傳則全部 |

若 `status` 傳入非合法值，視為未傳（不篩選）。

### GET /api/admin/orders/:id

**行為描述**：取得單一訂單詳情，額外 JOIN users 取得 `{ name, email }` 附在 `data.user`（若使用者已被刪除則為 null）。

---

## 前台 SSR 頁面

| URL | Layout | pageScript | 說明 |
|-----|--------|------------|------|
| `/` | front | index | 商品列表首頁 |
| `/products/:id` | front | product-detail | 商品詳情（productId 由 EJS locals 傳入） |
| `/cart` | front | cart | 購物車 |
| `/checkout` | front | checkout | 結帳表單 |
| `/login` | front | login | 登入/註冊 |
| `/orders` | front | orders | 我的訂單 |
| `/orders/:id` | front | order-detail | 訂單詳情（paymentResult 由 query param 傳入） |
| `/admin/products` | admin | admin-products | 後台商品管理 |
| `/admin/orders` | admin | admin-orders | 後台訂單管理 |

頁面路由**不做 server 端認證**，認證由前端 JS 在頁面載入後呼叫 API 處理（SPA-style fetch）。

---

## Seed 資料

### 管理員帳號

首次啟動（email 不存在時）自動建立：
- Email：`ADMIN_EMAIL`（預設 `admin@hexschool.com`）
- 密碼：`ADMIN_PASSWORD`（預設 `12345678`）
- 角色：`admin`

### 商品

若 products 表為空，自動 seed 8 筆花卉商品（粉色玫瑰、百合、向日葵、鬱金香、乾燥花圈、多肉、紅玫瑰、季節鮮花訂閱）。
