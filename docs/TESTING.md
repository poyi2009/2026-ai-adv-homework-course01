# TESTING.md

## 測試架構

- 框架：**Vitest**（`npm test` 執行）
- HTTP 測試：**supertest**（直接測試 Express app，不需啟動真實 server）
- 資料庫：**共用同一個 `database.sqlite`**（測試間不清空，後面的測試依賴前面的資料）

## 測試檔案與執行順序

**重要**：`fileParallelism: false`，且 `vitest.config.js` 強制固定執行順序，不可任意調換。

| 順序 | 檔案 | 測試範圍 |
|------|------|---------|
| 1 | `tests/auth.test.js` | 註冊、登入、重複 email、profile 取得 |
| 2 | `tests/products.test.js` | 商品列表分頁、商品詳情、404 |
| 3 | `tests/cart.test.js` | 訪客模式 CRUD、會員模式、不存在商品 |
| 4 | `tests/orders.test.js` | 建立訂單、空購物車、未授權、列表、詳情 |
| 5 | `tests/adminProducts.test.js` | 後台列表、新增、更新、刪除、權限驗證 |
| 6 | `tests/adminOrders.test.js` | 後台列表、status 篩選、詳情、權限驗證 |

**順序依賴說明**：
- `cart.test.js` 的 `beforeAll` 從 products API 取第一筆商品 ID，所以 products 必須先通過
- `orders.test.js` 需先把商品加入購物車，依賴 cart API 正常
- `adminOrders.test.js` 的 `beforeAll` 建立一筆訂單（需要完整的 register→cart→order 流程）

## 共用輔助函式（tests/setup.js）

```javascript
// 以 seed admin 帳號登入，回傳 JWT token 字串
async function getAdminToken()

// 快速註冊一個隨機 email 使用者，回傳 { token, user }
// overrides 可覆蓋 email / password / name
async function registerUser(overrides = {})
```

`registerUser` 的 email 格式：`test-<timestamp>-<random>@example.com`，確保每次呼叫都不重複。

## 執行指令

```bash
# 執行全部測試
npm test

# 執行特定檔案（需先安裝 vitest globally 或用 npx）
npx vitest run tests/auth.test.js

# 觀察模式（開發中使用）
npx vitest
```

## 撰寫新測試的步驟

1. **建立測試檔**：`tests/<feature>.test.js`
2. **匯入輔助函式**：
   ```javascript
   const { app, request, getAdminToken, registerUser } = require('./setup');
   ```
3. **依賴 `beforeAll` 準備前置資料**（如需要 token 或資源 ID）
4. **在 `vitest.config.js` sequence 中加入新檔案**（維持固定順序）
5. **每個 test case 驗證統一回應格式**：
   ```javascript
   expect(res.body).toHaveProperty('data');
   expect(res.body).toHaveProperty('error', null);  // 成功時
   expect(res.body).toHaveProperty('message');
   ```

### 範例：新增一個需要 admin 的 API 測試

```javascript
const { app, request, getAdminToken } = require('./setup');

describe('My Feature API', () => {
  let adminToken;

  beforeAll(async () => {
    adminToken = await getAdminToken();
  });

  it('should succeed with admin token', async () => {
    const res = await request(app)
      .get('/api/admin/my-feature')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('error', null);
  });

  it('should deny access without token', async () => {
    const res = await request(app).get('/api/admin/my-feature');
    expect(res.status).toBe(401);
    expect(res.body.error).not.toBeNull();
  });
});
```

## 常見陷阱

### 測試 bcrypt 速度慢

bcrypt 在 `NODE_ENV=test` 時 salt rounds 為 1。`vitest` 不自動設定 `NODE_ENV`，需確認 `.env` 中設定或在指令前加 `NODE_ENV=test`。若不設定，`registerUser` 會以 rounds=10 雜湊，導致測試極慢。

當前 `src/database.js` 邏輯：
```javascript
const saltRounds = process.env.NODE_ENV === 'test' ? 1 : 10;
```
僅 seed admin 時套用此邏輯；`authRoutes.js` 的 register handler 固定用 rounds=10（不受 NODE_ENV 影響）。

### 測試資料庫不清空

測試跑完的資料會留在 `database.sqlite`。多次執行測試會累積資料，`products` 列表的 ID 也可能因為先前 adminProducts 測試建立再刪除而有差異。若需要乾淨狀態，手動刪除 `database.sqlite`（下次 `require('./src/database')` 會重建並 seed）。

### 購物車測試的 session ID 唯一性

`cart.test.js` 使用 `'test-session-' + Date.now()` 作為 session ID，多次並行執行可能衝突。但因 `fileParallelism: false`，實際上不會發生。

### 管理員刪除商品前需確認無 pending 訂單

`adminProducts.test.js` 在刪除前建立一個新商品（不被任何訂單使用），避免碰到 409 衝突。若直接刪 seed 商品，可能因 `adminOrders.test.js` 的 `beforeAll` 已建立 pending 訂單而失敗。
