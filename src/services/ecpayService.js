const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');

const ECPAY_ENV = process.env.ECPAY_ENV || 'staging';
const IS_STAGING = ECPAY_ENV !== 'production';

const AIO_URL = IS_STAGING
  ? 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5'
  : 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5';

const QUERY_URL = IS_STAGING
  ? 'https://payment-stage.ecpay.com.tw/Cashier/QueryTradeInfo/V5'
  : 'https://payment.ecpay.com.tw/Cashier/QueryTradeInfo/V5';

// 依 PHP SDK UrlService::ecpayUrlEncode() 精確翻譯（CMV-SHA256 專用）
function ecpayUrlEncode(str) {
  let encoded = encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27')
    .toLowerCase();
  // .NET 特殊字元還原
  const replacements = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [enc, char] of Object.entries(replacements)) {
    encoded = encoded.split(enc).join(char);
  }
  return encoded;
}

function generateCheckMacValue(params) {
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIV = process.env.ECPAY_HASH_IV;

  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue')
  );
  const sorted = Object.keys(filtered)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIV}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash('sha256').update(encoded, 'utf8').digest('hex').toUpperCase();
}

// 格式化台灣時間為 yyyy/MM/dd HH:mm:ss
function getTaiwanDateString() {
  const now = new Date();
  const tw = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' }));
  const pad = n => String(n).padStart(2, '0');
  return `${tw.getFullYear()}/${pad(tw.getMonth() + 1)}/${pad(tw.getDate())} ${pad(tw.getHours())}:${pad(tw.getMinutes())}:${pad(tw.getSeconds())}`;
}

function buildAioParams(order, items) {
  const itemName = items
    .map(i => `${i.product_name} x${i.quantity}`)
    .join('#')
    .slice(0, 200);

  const baseUrl = process.env.BASE_URL || 'http://localhost:3001';

  const params = {
    MerchantID:        process.env.ECPAY_MERCHANT_ID,
    MerchantTradeNo:   order.merchant_trade_no,
    MerchantTradeDate: getTaiwanDateString(),
    PaymentType:       'aio',
    TotalAmount:       order.total_amount,
    TradeDesc:         `花卉電商訂單 ${order.order_no}`,
    ItemName:          itemName,
    ReturnURL:         `${baseUrl}/payments/ecpay/notify`,
    OrderResultURL:    `${baseUrl}/payments/ecpay/result`,
    ChoosePayment:     'ALL',
    EncryptType:       1,
  };

  params.CheckMacValue = generateCheckMacValue(params);
  return params;
}

// 主動查詢付款結果
function queryTradeInfo(merchantTradeNo) {
  const params = {
    MerchantID:      process.env.ECPAY_MERCHANT_ID,
    MerchantTradeNo: merchantTradeNo,
    TimeStamp:       Math.floor(Date.now() / 1000),
  };
  params.CheckMacValue = generateCheckMacValue(params);

  const body = querystring.stringify(params);
  const url = new URL(QUERY_URL);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          const result = Object.fromEntries(new URLSearchParams(data));
          resolve(result);
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { buildAioParams, queryTradeInfo, AIO_URL };
