# UI 視覺重新設計 —— 前端程式碼實作

## User Story

身為花漾生活的品牌方,`docs/plans/archive/2026-07-05-ui-visual-redesign.md` 已經完成「薰衣草霧 Lavender Mist」視覺重新設計的 Pencil 畫布 mockup(22 個 frame)並經確認,但畫布內容尚未落地到實際網站。這次任務要把該設計稿實作進 EJS + Tailwind v4 前端程式碼,讓使用者在瀏覽器實際看到新視覺,**純視覺重構,不新增/移除任何功能、欄位、路由、API**。

## Context

透過 Pencil MCP 讀取 `docs/design/flowershop-redesign.pen` 的 `get_variables`/`batch_get`/`get_screenshot`,取得完整色彩/字體/圓角 token 與 11 個頁面(桌面版)結構內容,並比對現有程式碼(`public/css/input.css`、`views/`、`public/js/`)後確認:

- 現有 `input.css` 的 `@theme` 已定義 `rose-primary`/`apricot`/`sage`/`cream`/`blush` 等 token 名稱,`.ejs` 全站皆引用這些 token class,只是數值是舊的暖色玫瑰粉系統,並非設計稿的薰衣草霧色系。
- 需新增 `berry`(#5C4470)、`gold`(#C9A46B)、`admin-panel`(#F0EAF7)、`border-hairline`(#E2D6EE)色彩 token,以及 `font-display`/`font-body` 字體 token 與 `radius-card`/`radius-frame` 圓角 token。
- 後台(`admin-header.ejs`/`admin-sidebar.ejs`)原本是 `bg-gray-900` 純黑 console 風格,與前台完全割裂。
- 標題字體原本逐處以 inline `style="font-family: 'Noto Serif TC'..."` 撰寫,無 utility class。
- 訂單狀態徽章色彩前台/後台不一致,且定義在 3 支 JS 檔(`orders.js`/`order-detail.js`/`admin-orders.js`),`header-init.js`/`notification.js` 也把 Tailwind class 字串寫死在 JS 裡。

已與使用者確認兩個實作範圍界線:圖示改用少量 inline SVG line-art(取代 emoji);危險/錯誤色僅訂單狀態徽章改用 `berry`,其餘表單驗證錯誤與刪除確認按鈕維持標準紅色。

## 實作內容

1. `public/css/input.css`:`@theme` 色彩改為薰衣草霧數值,新增 `berry`/`gold`/`admin-panel`/`border-hairline`/`font-display`/`font-body`/`radius-card`/`radius-frame` token。
2. 新增 `views/partials/icons.ejs`(SVG sprite:flower/package/file-text/truck/gift/heart/chevron-right/chevron-down/trash/circle-check)與 `views/partials/botanical-divider.ejs`(花藤分隔線簽名裝飾),掛載於 `front.ejs`/`admin.ejs` layout。
3. 前台 `header.ejs`/`footer.ejs`、後台 `admin-header.ejs`/`admin-sidebar.ejs` 套用新色彩/字體,後台側欄改用淺色底 + `berry` active 態 + `gold` 左側細邊條 + SVG icon,取代純黑 console 風格。
4. 全站標題 inline `font-family` style 改為 `font-display` utility;卡片圓角 `rounded-2xl`/`rounded-3xl` 統一收斂為 `rounded-card`/`rounded-frame`;價格數字改用 `font-display` + `text-berry`。
5. 逐頁調整(`index.ejs` Hero 全幅背景圖+漸層+置中文案、精選推薦錯落大小網格;`product-detail.ejs`/`cart.ejs`(新增免運進度條)/`checkout.ejs`;`login.ejs`(漸層背景+分隔線);`orders.ejs`/`order-detail.ejs`(資訊卡並排、狀態徽章);`404.ejs`(文案改版);`admin/products.ejs`/`admin/orders.ejs`),皆維持既有 Vue 邏輯、`v-for`/`v-model`/`data-*` 不變。
6. 同步修正 `header-init.js`、`notification.js`、`pages/orders.js`、`pages/order-detail.js`、`pages/admin-orders.js` 內硬編碼的 Tailwind class,統一訂單狀態徽章為 `apricot`/`sage`/`berry` 實色底白字。
7. `npm run css:build` 重新產生 `output.css`。

## 驗證

- `npm run css:build` 成功,`output.css` 內含新 token(已 grep 確認 `--color-berry`/`--radius-card`)。
- 18 個修改過的 EJS 模板以 Node `ejs.compile`/`ejs.render`(套用 `front.ejs`/`admin.ejs` layout + 假資料)全數編譯與渲染成功,無語法錯誤;首頁渲染結果 grep 確認含新文案「為日常，留一束詩意」與 `font-display`/`rounded-frame`/花藤 icon。
- `npm test`(vitest)32 個測試全數通過,未受影響。
- 實機瀏覽器手動檢視(桌面/手機寬度,前後台共 11 頁)由使用者於本機環境進行(執行環境的 sandbox 網路隔離無法讓 Claude 端 curl 連線到本機 dev server)。

## Tasks

- [x] 更新 `input.css` 設計 token(色彩/字體/圓角)
- [x] 建立 `icons.ejs` 與 `botanical-divider.ejs` partial
- [x] 前台 header/footer 視覺更新
- [x] 後台 header/sidebar 統一風格
- [x] 首頁 `index.ejs` 視覺重構(Hero 全幅背景圖 + 錯落大小網格)
- [x] 商品詳情/購物車/結帳頁視覺更新
- [x] 登入/我的訂單/訂單詳情/404 頁視覺更新
- [x] 後台商品/訂單管理頁視覺更新
- [x] JS 硬編碼 class 字串同步更新(header-init/notification/orders/order-detail/admin-orders)
- [x] `npm run css:build` 並以靜態編譯/渲染檢查 + `npm test` 驗證
- [x] 移至 `docs/plans/archive/` 並更新 `docs/CHANGELOG.md`
