# CLAUDE.md

## 專案概述

花卉電商網站 — Node.js + Express + SQLite + EJS + Tailwind CSS
提供前台購物流程（商品瀏覽、購物車、結帳）與後台管理（商品 CRUD、訂單檢視）的全端 MPA（Multi-Page Application）。

## 常用指令

```bash
npm run dev:server   # 啟動開發伺服器（port 3001）
npm run dev:css      # Tailwind CSS watch mode
npm start            # 先 build CSS 再啟動（生產用）
npm test             # 執行所有測試（vitest）
npm run openapi      # 從 JSDoc 產生 openapi.json
```

## 關鍵規則

- **JWT_SECRET 為必要環境變數**：`server.js` 在啟動時檢查，缺少則 `process.exit(1)`
- **購物車採雙模式認證**：`X-Session-Id` header（訪客）或 `Authorization: Bearer <token>`（會員）二擇一；若 Authorization header 存在但 token 無效，直接回 401 不 fallback session
- **建立訂單為 DB transaction**：原子性地建立 order + order_items、扣庫存、清空購物車，不可拆分
- **測試執行有固定順序**：`vitest.config.js` 中 `fileParallelism: false`，且 sequence 指定順序；不可並行執行
- **功能開發使用 docs/plans/ 記錄計畫；完成後移至 docs/plans/archive/**

## 詳細文件

- [./docs/README.md](./docs/README.md) — 項目介紹與快速開始
- [./docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 架構、目錄結構、資料流
- [./docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 開發規範、命名規則
- [./docs/FEATURES.md](./docs/FEATURES.md) — 功能列表與完成狀態
- [./docs/TESTING.md](./docs/TESTING.md) — 測試規範與指南
- [./docs/CHANGELOG.md](./docs/CHANGELOG.md) — 更新日誌
