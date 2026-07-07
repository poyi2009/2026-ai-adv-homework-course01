# CHANGELOG.md

## [Unreleased]

### 設計

- **UI 視覺重新設計(Pencil 畫布 mockup)**:前台 9 頁 + 後台 2 頁,共 11 個頁面 × 桌面/手機版,共 22 個 frame 視覺稿。改採「薰衣草霧 Lavender Mist」粉嫩紫調色系 + 香檳金強調色,新增花藤分隔線簽名裝飾,統一前後台視覺語言(後台不再是純黑 console)。首頁 Hero 融入淺景深花束攝影照 + 漸層色調疊加,精選推薦區改為錯落大小網格(Asymmetric Masonry)。純視覺設計稿,**未變更任何程式碼、API 或功能**,詳見 `docs/plans/archive/2026-07-05-ui-visual-redesign.md`。
- **UI 視覺重新設計實作落地**:將上述 Pencil 設計稿實作進 `public/css/input.css`(新增 `berry`/`gold`/`admin-panel`/`border-hairline`/`font-display`/`font-body`/`radius-card`/`radius-frame` token)、前後台共用元件(新增 SVG icon sprite 與花藤分隔線 partial)、11 個頁面模板與 5 支前端 JS(統一訂單狀態徽章色彩)。同樣**未新增/移除任何功能、欄位、路由、API**,詳見 `docs/plans/archive/2026-07-06-ui-visual-redesign-implementation.md`。
- **UI 響應式(RWD)修正**:實測手機版後發現前次視覺重構未涵蓋響應式版型,依 Pencil `.pen` 檔案中既有的手機版 frame(390px)補齊:
  - **前台 Header**:桌面版維持文字導覽,手機版改為 icon-only(購物車圖示 + 漢堡選單),點擊漢堡選單以浮動（absolute）方式展開選單於下方內容之上,不再擠壓版面;選單背景改與頁面背景一致並置中對齊
  - **首頁 Hero**:移除原本手機版負邊距(`-mx-4`)撐滿邊界的做法,改與其餘區塊採用一致的容器間距(`px-4 md:px-8 lg:px-12`),修正手機/桌面版 Hero 貼齊邊界、無留白的問題
  - **購物車、我的訂單**:新增手機版專用卡片版型(直向堆疊 縮圖/名稱/數量、雙列卡片),取代原本桌面單列橫排在窄螢幕擠壓變形的版型
  - **後台管理**:側欄改為手機版可收合的 off-canvas 抽屜(漢堡選單開關 + 遮罩),個人資訊區改為點擊帳號圖示展開;商品/訂單管理表格新增手機版卡片列表,並將表格欄位文字統一改為向左對齊
  - 修正過程中另排除兩個版面錯誤:抽屜/選單開啟時容器高度未隨內容增加導致內容溢出無背景色遮擋;後台側欄抽屜从最頂端(`inset-y-0`)延伸,被 z-index 較高的 sticky header 蓋住導致「商品管理」連結被遮蔽
  - 同樣**未新增/移除任何功能、欄位、路由、API**,純響應式版型與樣式修正,詳見 `docs/plans/archive/2026-07-06-ui-rwd-fix.md`

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
