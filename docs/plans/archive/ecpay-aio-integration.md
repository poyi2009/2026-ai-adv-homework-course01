# ECPay AIO 金流串接計畫

## Context

花卉電商網站目前的「付款」功能純屬模擬：訂單詳情頁有「付款成功」「付款失敗」兩個假按鈕，直接呼叫 `PATCH /api/orders/:id/pay` 更新 DB 狀態，並無真實金流。

本計畫將串接 ECPay 全方位金流（AIO），讓消費者跳轉至綠界付款頁完成交易。由於伺服器運行在本地端，ECPay 的 S2S Server Notify（ReturnURL）無法觸及，因此**付款結果驗證改為當 OrderResultURL 瀏覽器 redirect 回來時，本地端主動呼叫 QueryTradeInfo API 核實**。

## 技術選型

- **金流方案**：AIO（CMV-SHA256），最適合 SSR/MPA 架構
- **測試端點**：`https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5`
- **查詢端點**：`https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5`
- **無需 npm 套件**：Node.js 內建 `crypto` + `https` 即可

## 付款流程

```
[訂單詳情頁] 「前往付款」按鈕
     ↓ apiFetch POST /api/payments/ecpay/initiate/:orderId (JWT auth)
[後端] 生成 MerchantTradeNo、建 AIO params、計算 CheckMacValue
     ↓ 儲存 merchant_trade_no 至 DB，回傳 { formAction, params }
[前端] 動態建立 <form> 填入 params，auto-submit 到 ECPay
     ↓
[消費者在 ECPay 付款頁完成付款]
     ↓ 瀏覽器 POST redirect 到 OrderResultURL
[後端] POST /payments/ecpay/result
     ↓ 1. 取 MerchantTradeNo 查 DB 找訂單
       2. 呼叫 QueryTradeInfo API 主動驗證
       3. 更新 order.status ('paid' 或 'failed')
       4. 302 redirect 到 /orders/:id?payment=success 或 ?payment=failed
[訂單詳情頁] 已有 ?payment query → data-payment-result → 顯示訊息
```

---

## 一、DB 變更

**檔案**：`src/database.js`

在 `orders` CREATE TABLE 語句的 `created_at` 前加入：
```sql
merchant_trade_no TEXT UNIQUE,
```

同時在 `initializeDatabase()` 後加入遷移邏輯（對已存在 DB 補欄位）：
```javascript
try {
  db.exec('ALTER TABLE orders ADD COLUMN merchant_trade_no TEXT');
} catch (_) {
  // 欄位已存在，忽略
}
```

> ⚠️ **SQLite 限制**：`ALTER TABLE ADD COLUMN` 不支援 `UNIQUE` 約束，否則 migration 會靜默失敗（被 catch 吃掉），導致欄位不存在而 500 錯誤。`CREATE TABLE` 裡的 `UNIQUE` 宣告對新建 DB 仍有效；既有 DB 的唯一性由 `generateMerchantTradeNo()` 時間戳確保。

---

## 二、新建 `src/services/ecpayService.js`

### `ecpayUrlEncode(str)`
依 ECPay PHP SDK `UrlService.php` 精確翻譯（Node.js 版）：
```javascript
// encodeURIComponent → 替換 %20→+ → ~ 補編→%7e → ' 補→%27 → toLowerCase
// → .NET 特殊字元還原（%2d→- %5f→_ %2e→. %21→! %2a→* %28→( %29→)）
```

### `generateCheckMacValue(params, hashKey, hashIV)`
1. 過濾掉 CheckMacValue 本身
2. 按 key（case-insensitive）排序
3. 組合成 `HashKey=xxx&k1=v1&...&HashIV=xxx`
4. 套用 `ecpayUrlEncode`
5. SHA256 → `toUpperCase()`

### `buildAioParams(order, items)`
回傳完整 AIO 參數物件（不含 CheckMacValue）：
```javascript
{
  MerchantID:        process.env.ECPAY_MERCHANT_ID,
  MerchantTradeNo:   order.merchant_trade_no,
  MerchantTradeDate: /* UTC+8 格式 yyyy/MM/dd HH:mm:ss */,
  PaymentType:       'aio',
  TotalAmount:       order.total_amount,
  TradeDesc:         '花卉電商訂單 ' + order.order_no,
  ItemName:          /* items 組成 "商品A x2#商品B x1"，截斷至200字 */,
  ReturnURL:         'http://localhost:3001/payments/ecpay/notify',
  OrderResultURL:    'http://localhost:3001/payments/ecpay/result',
  ChoosePayment:     'ALL',
  EncryptType:       1,
}
```
最後計算並附加 `CheckMacValue`。

### `queryTradeInfo(merchantTradeNo)`
POST（form-encoded）到 QueryTradeInfo 端點：
```
MerchantID, MerchantTradeNo, TimeStamp（Unix 秒數）, CheckMacValue
```
使用 Node.js 內建 `https.request` 發送請求；
回應為 URL-encoded 字串，以 `new URLSearchParams(responseText)` 解析。
檢查 `TradeStatus === '1'` 表示已付款成功。

---

## 三、新建 `src/routes/paymentRoutes.js`

```javascript
// POST /api/payments/ecpay/initiate/:orderId  (需 JWT)
router.post('/ecpay/initiate/:orderId', authMiddleware, async (req, res) => {
  // 1. 查訂單（屬於此 user，status === 'pending'）
  // 2. 生成 MerchantTradeNo：'EC' + Date.now() + random5chars（共20字）
  // 3. 更新 DB order.merchant_trade_no
  // 4. buildAioParams(order, items)
  // 5. 回傳 JSON { formAction: 'https://payment-stage.ecpay.com.tw/...', params }
});

// POST /payments/ecpay/result  (ECPay 瀏覽器 redirect，無 JWT)
router.post('/ecpay/result', async (req, res) => {
  // 1. req.body.MerchantTradeNo → 查 DB 取 order
  // 2. 呼叫 queryTradeInfo(merchantTradeNo)
  // 3. TradeStatus === '1' → status='paid', else status='failed'
  // 4. res.redirect(`/orders/${order.id}?payment=success`)
});

// POST /payments/ecpay/notify  (ReturnURL，本地收不到，但需掛 endpoint 防 ECPay 報錯)
router.post('/ecpay/notify', (req, res) => {
  res.type('text').send('1|OK');
});
```

---

## 四、修改 `app.js`

在 `app.use('/api/orders', ...)` 下方加入：
```javascript
const paymentRoutes = require('./src/routes/paymentRoutes');
app.use('/api/payments', paymentRoutes.apiRouter);
app.use('/payments', paymentRoutes.pageRouter);
```

---

## 五、修改 `views/pages/order-detail.ejs`

**移除**（L74-89）的兩個假按鈕，**替換**為：
```html
<div v-if="order.status === 'pending'" class="flex gap-4">
  <button
    @click="handlePayWithECPay"
    :disabled="paying"
    class="bg-rose-primary text-white px-8 py-3 rounded-full text-sm font-medium hover:bg-rose-primary/90 transition-colors disabled:opacity-50"
  >
    {{ paying ? '跳轉中...' : '前往 ECPay 付款' }}
  </button>
</div>
```

---

## 六、修改 `public/js/pages/order-detail.js`

移除 `simulatePay`、`handlePaySuccess`、`handlePayFail`，新增：
```javascript
async function handlePayWithECPay() {
  if (!order.value || paying.value) return;
  paying.value = true;
  try {
    const res = await apiFetch('/api/payments/ecpay/initiate/' + order.value.id, {
      method: 'POST'
    });
    const { formAction, params } = res.data;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = formAction;
    Object.entries(params).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  } catch (e) {
    Notification.show('無法啟動付款流程，請稍後再試', 'error');
    paying.value = false;
  }
}
```

---

## 驗證步驟

1. `npm run dev:server` 啟動伺服器
2. 登入並建立訂單，進入訂單詳情頁 `/orders/:id`
3. 確認只顯示「前往 ECPay 付款」按鈕（舊假按鈕消失）
4. 點擊按鈕後瀏覽器應跳轉至 `payment-stage.ecpay.com.tw` 付款頁
5. 使用測試卡 `4311-9522-2222-2222` 完成付款，3DS code `1234`
6. 付款後應 redirect 回 `/orders/:id?payment=success`，訂單狀態顯示「已付款」
7. 查 DB 確認 `orders.status = 'paid'`，`merchant_trade_no` 有值
8. 測試失敗路徑：在 ECPay 頁面取消或使用無效卡，確認 redirect 到 `?payment=failed`

## 注意事項

- `MerchantTradeDate` 必須是 UTC+8（台灣時間），格式為 `yyyy/MM/dd HH:mm:ss`
- `ItemName` 超過 200 字元需截斷（避免 CheckMacValue 掉單）
- `MerchantTradeNo` 每筆唯一，不可重複（測試帳號共用，已用過的 trade no 會 400）
- QueryTradeInfo `TimeStamp` 為 Unix 秒數：`Math.floor(Date.now() / 1000)`
- ReturnURL 本地收不到通知，不影響付款完成；`/payments/ecpay/notify` 只需回 `1|OK`
- 正式上線前需更換 `.env` 中的 ECPAY_MERCHANT_ID / HASH_KEY / HASH_IV 為商家正式帳號
