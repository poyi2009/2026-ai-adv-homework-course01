const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const authMiddleware = require('../middleware/authMiddleware');
const { buildAioParams, queryTradeInfo, AIO_URL } = require('../services/ecpayService');

const apiRouter = express.Router();
const pageRouter = express.Router();

// 生成唯一 MerchantTradeNo（英數字，最長20字）
function generateMerchantTradeNo() {
  const ts = Date.now().toString(); // 13 碼
  const rand = Math.random().toString(36).slice(2, 9).toUpperCase(); // 7 碼
  return `EC${ts}${rand}`.slice(0, 20);
}

// POST /api/payments/ecpay/initiate/:orderId
apiRouter.post('/ecpay/initiate/:orderId', authMiddleware, (req, res) => {
  const userId = req.user.userId;
  const orderId = req.params.orderId;

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, userId);
  if (!order) {
    return res.status(404).json({ data: null, error: 'NOT_FOUND', message: '訂單不存在' });
  }
  if (order.status !== 'pending') {
    return res.status(400).json({ data: null, error: 'INVALID_STATUS', message: '訂單狀態不是 pending，無法付款' });
  }

  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

  // ECPay 規定：已送出的 MerchantTradeNo 即使付款未完成也不可重複使用
  // 因此每次發起付款都產生新流水號並覆寫 DB（result callback 以最新值查單）
  const merchantTradeNo = generateMerchantTradeNo();
  db.prepare('UPDATE orders SET merchant_trade_no = ? WHERE id = ?').run(merchantTradeNo, orderId);

  const orderWithTradeNo = { ...order, merchant_trade_no: merchantTradeNo };
  const params = buildAioParams(orderWithTradeNo, items);

  res.json({
    data: { formAction: AIO_URL, params },
    error: null,
    message: '付款資訊建立成功'
  });
});

// POST /payments/ecpay/result  (ECPay OrderResultURL 瀏覽器 redirect)
pageRouter.post('/ecpay/result', async (req, res) => {
  const merchantTradeNo = req.body.MerchantTradeNo;

  if (!merchantTradeNo) {
    return res.redirect('/?payment=failed');
  }

  const order = db.prepare('SELECT * FROM orders WHERE merchant_trade_no = ?').get(merchantTradeNo);
  if (!order) {
    return res.redirect('/?payment=failed');
  }

  // 已處理過（冪等）
  if (order.status !== 'pending') {
    const result = order.status === 'paid' ? 'success' : 'failed';
    return res.redirect(`/orders/${order.id}?payment=${result}`);
  }

  try {
    const tradeInfo = await queryTradeInfo(merchantTradeNo);
    const isPaid = tradeInfo.TradeStatus === '1';
    const newStatus = isPaid ? 'paid' : 'failed';
    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, order.id);
    const result = isPaid ? 'success' : 'failed';
    res.redirect(`/orders/${order.id}?payment=${result}`);
  } catch (err) {
    console.error('[ECPay] QueryTradeInfo 失敗:', err.message);
    res.redirect(`/orders/${order.id}?payment=failed`);
  }
});

// POST /payments/ecpay/notify  (ReturnURL，本地無法接收，只需回 1|OK 防重試)
pageRouter.post('/ecpay/notify', (req, res) => {
  res.type('text').send('1|OK');
});

module.exports = { apiRouter, pageRouter };
