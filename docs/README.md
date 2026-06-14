# 花卉電商網站

花卉電商購物平台，支援前台商品瀏覽與購物流程，以及後台商品管理與訂單查閱。

## 技術棧

| 層次 | 技術 |
|------|------|
| 執行環境 | Node.js |
| Web 框架 | Express ~4.16 |
| 資料庫 | SQLite（via better-sqlite3） |
| 模板引擎 | EJS 5 |
| CSS 框架 | Tailwind CSS 4 |
| 認證 | JWT（jsonwebtoken，HS256，7d） |
| 密碼雜湊 | bcrypt |
| ID 生成 | UUID v4 |
| 測試框架 | Vitest + supertest |
| OpenAPI | swagger-jsdoc（JSDoc → openapi.json） |

## 快速開始

```bash
# 1. 安裝依賴
npm install

# 2. 建立環境變數
cp .env.example .env
# 編輯 .env，至少設定 JWT_SECRET

# 3. 啟動開發伺服器（CSS 另開 terminal watch）
npm run dev:server
# 另一個 terminal：
npm run dev:css

# 4. 開啟瀏覽器
# 前台：http://localhost:3001
# 後台：http://localhost:3001/admin/products
```

預設管理員帳號由 `.env` 的 `ADMIN_EMAIL` / `ADMIN_PASSWORD` 控制（預設 `admin@hexschool.com` / `12345678`），首次啟動時自動 seed。

## 常用指令

| 指令 | 說明 |
|------|------|
| `npm run dev:server` | 啟動 Express server（port 3001） |
| `npm run dev:css` | Tailwind CSS watch mode |
| `npm start` | Build CSS + 啟動（生產用） |
| `npm test` | 執行所有 Vitest 測試 |
| `npm run openapi` | 從 route JSDoc 產生 openapi.json |
| `npm run css:build` | 單次 build + minify CSS |

## 文件索引

| 文件 | 說明 |
|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 目錄結構、啟動流程、API 路由、DB schema、認證機制 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 命名規則、新增功能步驟、環境變數表、JSDoc 規範 |
| [FEATURES.md](./FEATURES.md) | 功能清單、行為描述、錯誤碼對照 |
| [TESTING.md](./TESTING.md) | 測試架構、執行順序、輔助函式、撰寫指南 |
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日誌 |
| [plans/](./plans/) | 開發中計畫 |
| [plans/archive/](./plans/archive/) | 已完成計畫歸檔 |
