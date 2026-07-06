---
name: e2e-payment-test
description: 使用 Playwright MCP 對花漾生活（本專案）進行綠界 ECPay 金流的端到端測試，涵蓋從商品瀏覽、加入購物車、結帳到付款完成的完整流程，包含正常流程與付款失敗、欄位驗證錯誤等異常情境。觸發時機：使用者要求「E2E 測試」「金流測試」「ECPay 測試」「付款流程測試」時使用。
---

# 綠界 ECPay 金流 E2E 測試

## 測試目標

驗證花漾生活網站的完整購物付款流程：從商品瀏覽、加入購物車、結帳建立訂單，到導向綠界 ECPay 測試環境（staging）完成信用卡付款，並確認付款結果正確回寫到訂單狀態。

測試帳號：`admin@hexschool.com` / `12345678`（此帳號 role 為 admin，但購物車/結帳/訂單路由不檢查 role，可正常當一般會員使用）。

## 環境準備

1. **先確認伺服器是否已在執行**：用 `curl -s -o /dev/null -w "%{http_code}" http://localhost:3001` 或 `ss -tlnp | grep 3001` 檢查 port 3001 是否已有服務回應。若已有（例如前一次對話留下的背景程序），直接沿用即可，不需重新啟動。
2. **啟動開發伺服器**：若尚未啟動，執行 `npm run dev:server`（預設 port 3001，需要 `.env` 內的 `JWT_SECRET` 等變數存在）。
   - ⚠️ 若舊的伺服器程序仍在背景執行，重新啟動會立即因 `EADDRINUSE` crash，背景任務會收到「failed」通知——這不代表測試環境有問題，只代表 port 已被舊程序佔用。用上一步的方式確認舊程序仍正常回應即可，無需理會該失敗通知，也不必費工夫去釐清是哪個 PID 在監聽。
3. **確認 Playwright 瀏覽器可視化顯示**：本專案透過 Playwright MCP 直接在 WSL 內啟動瀏覽器（`.mcp.json` 的 `playwright` server 設定 `--executable-path` 指向已安裝的 Chromium），並利用 WSLg 把視窗顯示在 Windows 桌面上，讓使用者能即時看到測試過程。
   - 若第一次呼叫 `browser_navigate` 出現「Target page, context or browser has been closed」錯誤，通常是前一個 session 的瀏覽器已關閉；直接重新呼叫一次 `browser_navigate` 即可自動啟動新瀏覽器，不需要額外處理或提前排查。
4. **⚠️ 網路沙盒陷阱**：若用一般 Bash 工具（`nohup ... &` 或 `run_in_background`）啟動伺服器，很可能跑在跟 Playwright 瀏覽器不同的網路命名空間，導致瀏覽器連到 `localhost:3001` 時出現 `net::ERR_CONNECTION_REFUSED`（即使 Bash 自己 curl 得到 200）。
   - **判斷方式**：在 Bash 裡執行 `ip addr show eth0`，如果報 "Device does not exist"，代表目前處在沙盒網路命名空間。
   - **解法**：啟動伺服器時，`Bash` 工具call同時加上 `run_in_background: true` 與 `dangerouslyDisableSandbox: true`，讓伺服器跑在跟瀏覽器相同的真實主機網路環境。
5. **系統依賴套件**：若瀏覽器啟動報 `Missing system dependencies`，需要 `sudo apt-get install -y libnss3 libnspr4 libasound2t64`（Ubuntu 24.04 環境）。

## 測試步驟（正常流程）

| # | 動作 | 對應頁面/元素 |
|---|------|--------------|
| 1 | 導覽至首頁 | `http://localhost:3001` |
| 2 | 若導覽列已顯示「登出」，先登出，確保乾淨狀態 | 導覽列「登出」按鈕 |
| 3 | 導覽至登入頁，輸入帳密登入 | `/login`，Email／密碼欄位靠 placeholder 定位（Vue SPA 表單，無 name/id） |
| 4 | 回到首頁，選一個商品點擊「加入購物車」 | 首頁商品卡片的「加入購物車」按鈕 |
| 5 | 前往購物車頁確認商品與金額 | `/cart` |
| 6 | 點擊「前往結帳」 | `/cart` 頁面按鈕 |
| 7 | 填寫收件人姓名、Email、收件地址 | `/checkout` 表單 |
| 8 | 點擊「確認送出訂單」 | 建立訂單，導向 `/orders/:id`，狀態為「待付款」 |
| 9 | 點擊「前往 ECPay 付款」 | 訂單詳情頁按鈕，整頁跳轉到 `https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5` |
| 10 | 選擇「信用卡」付款方式（通常預設選中） | ECPay 付款方式列表 |
| 11 | 填寫測試信用卡資料 | 見下方「測試資料」 |
| 12 | 點擊「立即付款」 | ⚠️ 第一次點擊通常會先跳出「您目前正在使用的是綠界科技的付款測試環境」提醒彈窗，並吃掉這次點擊（不會出現付款確認彈窗）。點擊彈窗的「關閉」後，需**再點一次「立即付款」**，才會跳出確認彈窗「您確定使用信用卡，支付此筆訂單金額」 |
| 13 | 點擊「確定」 | 導向 3D 驗證頁 `cc-stage.ecpay.com.tw/form_ssl.php` |
| 14 | 點擊「取得OTP服務密碼」 | 測試環境會直接把 OTP 密碼顯示在畫面上（如 `1234`） |
| 15 | 輸入顯示的 OTP 密碼，點擊「送出」 | 完成 3D 驗證 |
| 16 | 驗證導回網站 | URL 變為 `http://localhost:3001/orders/:id?payment=success` |

### 測試資料

| 欄位 | 值 |
|------|-----|
| 收件人姓名 | 王小明（任意） |
| 收件 Email | admin@hexschool.com |
| 收件地址 | 台北市信義區松仁路100號（任意） |
| 測試信用卡卡號 | 4311-9522-2222-2222 |
| 有效期限 | 12 / 29（任意未來日期） |
| CVV | 222 |
| 持卡人姓名 | WANG XIAO MING（英文） |
| 手機號碼 | 0987654321 |
| 3D 驗證 OTP | 頁面上會直接顯示（免猜測，例：1234） |

## 預期結果

### 正常流程 ✅（已實際驗證）

- 加入購物車後，`/cart` 顯示正確品項與小計，滿 NT$500 顯示「已達免運門檻！」
- 送出訂單後，訂單狀態為「待付款」，出現「前往 ECPay 付款」按鈕
- ECPay 付款頁正確帶入訂單編號、商店名稱、商品明細與金額
- 信用卡卡號填寫正確格式後，欄位旁會顯示發卡行識別（如「VISA 中國信託」）
- 3D 驗證通過後導回 `/orders/:id?payment=success`
- 訂單詳情頁顯示綠色訊息「付款成功！感謝您的購買。」，訂單狀態標籤變為「已付款」（綠色）

### 異常情境

#### 1. 信用卡卡號欄位驗證失敗 ✅（已實際驗證觸發並排除）
- **觸發方式**：用 `browser_type` 但不帶 `slowly: true`（等同一次性 `fill()`）填入卡號分段欄位。
- **預期現象**：欄位裡雖然看得到數字，但點擊「立即付款」後，卡號欄位下方會顯示紅字「請輸入信用卡卡號」，無法繼續付款。因為 ECPay 前端用 keyup/keypress 事件驗證卡號，`fill()` 不會觸發完整鍵盤事件序列。
- **修正方式**：改用 `browser_type` 並帶 `slowly: true` 逐字輸入，才能觸發驗證通過。

#### 2. 付款取消／失敗流程（依程式碼推斷，尚未實際跑過完整案例）
- **觸發方式**：在 3D 驗證頁（步驟 13-14）點擊「取消(Cancel)」，或在 ECPay 付款方式頁點擊瀏覽器返回。
- **預期現象**：依 `src/routes/paymentRoutes.js` 的 `/payments/ecpay/result` 邏輯，ECPay 會把交易結果告知後端，訂單狀態應從 `pending` 變為 `failed`，並導回 `/orders/:id?payment=failed`，訂單詳情頁應顯示失敗提示（而非綠色成功訊息）。
- 若要單獨測試失敗情境，也可以直接用無效卡號（如全部填 `0000`）或到期日填過去日期，讓 3D 驗證環節無法通過。

#### 3. 結帳表單必填欄位為空（依前端程式碼推斷，尚未實際跑過）
- **觸發方式**：`/checkout` 頁面收件人姓名／Email／地址其中一欄留空即點擊「確認送出訂單」。
- **預期現象**：應顯示前端驗證錯誤訊息，且不應建立訂單（不應導向 `/orders/:id`）。若前端未做驗證而直接送出後端，需檢查 API 是否回傳 400 錯誤並在頁面上顯示錯誤提示。

## 使用的瀏覽器自動化工具

本測試全程使用 **Playwright MCP**（`mcp__playwright__*` 系列工具），透過 WSLg 讓瀏覽器視窗顯示在使用者桌面上，讓使用者能全程觀看測試操作。

| 工具 | 用途 | 範例 |
|------|------|------|
| `mcp__playwright__browser_navigate` | 導覽至指定 URL | `{ url: "http://localhost:3001/login" }` |
| `mcp__playwright__browser_snapshot` | 取得目前頁面的 accessibility tree，取得可操作元素的 `ref`（點擊/輸入前必做，因為 ref 每次 snapshot 都會變） | 無參數 |
| `mcp__playwright__browser_type` | 在輸入框填入文字；信用卡等有前端驗證的欄位務必加 `slowly: true` | `{ target: "<ref>", element: "Email 輸入框", text: "admin@hexschool.com" }` |
| `mcp__playwright__browser_click` | 點擊按鈕/連結 | `{ target: "<ref>", element: "登入按鈕" }` |
| `mcp__playwright__browser_take_screenshot` | 截圖存證（用於視覺驗證，測試結束記得清除暫存截圖檔） | `{ type: "png", scale: "css", filename: "step.png" }` |
| `mcp__playwright__browser_console_messages` | 檢查主控台是否有非預期錯誤 | `{ level: "error" }` |

### 操作要點

- 每次點擊/輸入前，先用 `browser_snapshot` 取得最新的 `ref`，不要重複使用前一輪快照的 ref（頁面跳轉或重新渲染後 ref 會失效）。
- 填寫像信用卡卡號這種有 JS 前端驗證（keyup/keypress 監聽）的分段輸入框時，一律加 `slowly: true`，避免驗證誤判為空值。
- 用 `browser_take_screenshot` 搭配 `Read` 工具查看截圖內容以視覺確認畫面（截圖預設存到專案根目錄或指定路徑），測試完成後記得刪除這些暫存截圖，避免污染版控。
- ECPay 測試環境的提醒彈窗**不是頁面載入時就出現**，而是在第一次點擊「立即付款」時才跳出並吃掉那次點擊；需點擊「關閉」後再點一次「立即付款」，才會進入真正的付款確認彈窗（見上方步驟 12）。
- `browser_snapshot` 與 `browser_console_messages` 預設會把內容另存到專案根目錄的 `.playwright-mcp/` 資料夾（即使沒有指定 `filename` 參數）。測試結束後不必逐一刪除，只要確認 `.gitignore` 已包含 `.playwright-mcp/` 即可（尚未加入的話補上一行）；在有些權限設定下 `rm -rf` 該資料夾可能被判定為破壞性操作而遭拒，用 `.gitignore` 排除更可靠。
