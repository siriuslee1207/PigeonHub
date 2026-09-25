# PigeonHub 鴿友會官網

一群都被會長 MinJ 放過鴿子的人組成的鴿友會。網站部署在 Vercel，包含首頁、鴿友名錄，以及每位鴿友一個固定網址的個人頁，網址可直接放進電子名片或做成 QR code。

## 網址規則

| 頁面 | 網址 |
|---|---|
| 首頁 | `/` |
| 鴿友名錄 | `/members` |
| 個人頁 | `/members/<slug>`，例如 `/members/minj` |

slug 一律小寫英數。**定案並印上名片後請勿更動**，否則 QR code 會失效。

### 連結清單（驗證測試用）

全站所有網址都整理在 [`docs/links.txt`](docs/links.txt)（一行一個網址，可直接餵給 curl 或 QR 工具）與 [`docs/links.json`](docs/links.json)（含頁面名稱、路徑、預期 HTTP 狀態碼；`name` 與 QR 輸出檔名一致）。清單由 [`scripts/links/export_links.mjs`](scripts/links/export_links.mjs) 讀 `members.ts` 產生，**改過成員後請重新產生並一起 commit**：

```bash
npm run links                              # 重新產生 docs/links.txt、docs/links.json
npm run links:check                        # 產生後逐一請求線上網址，比對狀態碼（含一條應回 404 的探測）
npm run links -- --base-url https://你的網域  # 接上自訂網域後改網域；預設是目前的 Vercel 網址
```

## 本機開發

```bash
npm install
npm run dev      # 開發模式 http://localhost:3000，改檔即時更新
npm run lint     # ESLint
npm run build    # 正式建置，會產生所有靜態頁面
npm run check    # lint + build，其中 build 就是 Vercel 部署時跑的步驟
npm run preview  # check 之後以正式模式啟動 http://localhost:3100
npm run images        # 把 data/avatars/、data/photos/ 的照片轉成網站用圖檔（需要 uv，見下方「頭像與照片」）
npm run images:check  # 檢查圖片清單、檔案與 members.ts 是否一致；build 前會自動執行
```

### commit 前先在本機驗證

Vercel 部署做的事就是 `next build` 然後啟動伺服器，所以在本機跑 `npm run preview` 看到的畫面，就是推上去後線上會看到的畫面。建議流程：

1. 改完資料或程式後執行 `npm run preview`。
2. lint 或 build 失敗就代表線上部署也會失敗，先修好再說。
3. 用瀏覽器開 http://localhost:3100 ，把首頁、名錄、改到的個人頁都點過一遍，手機寬度也切一下看看。
4. 都沒問題再 commit、push。

`npm run dev` 是開發模式，會多出 dev 專用的提示與較慢的載入，且不會跑 TypeScript 全檔檢查，所以最終確認請以 `npm run preview` 為準。

## 編輯鴿友資料

所有內容都在 [`src/data/members.ts`](src/data/members.ts)，一位鴿友一個物件，順序就是名錄的顯示順序。填好後把 `isPlaceholder: true` 那行刪掉，頁面上的「資料待補」提示就會消失。

| 欄位 | 說明 |
|---|---|
| `slug` | 網址段，小寫英數，不可重複 |
| `displayName` | 顯示名稱（暱稱） |
| `realName` | 本名（選填） |
| `role` | `"會長"` 或 `"會員"` |
| `location` | 所在地（選填） |
| `tagline` | 一句話簡介 |
| `bio` | 自介段落（選填），用 `\n` 分段 |
| `avatar` | （選填）手動指定頭像路徑，例如 `"/avatars/TempPP.svg"`。一般不用填，照片交給下方「頭像」流程處理；沒照片也沒指定就顯示預設頭像 |
| `highlights` | 事蹟列表：被會長放鴿子的紀錄，會長本人則是放鴿子的紀錄。每筆有 `year`（年份，選填）、`title`（標題）、`description`（補充，選填）；有年份的由舊到新排，沒年份的排最後 |

範例：

```ts
{
  slug: "kk",
  displayName: "KK",
  role: "會員",
  tagline: "被放鴿子三次仍然相信會長的人。",
  bio: "第一段自介。\n第二段自介。",
  highlights: [
    { year: 2025, title: "跨年夜被放鴿子", description: "會長說在路上了，然後就沒有然後了。" },
    { year: 2024, title: "生日聚餐等了兩小時" },
  ],
},
```

### 頭像與照片

照片不用自己裁切壓縮，交給腳本：

1. **頭像**：原始照片存成 `data/avatars/<slug>.jpg`，檔名就是該鴿友的 slug。
   **相簿照片**：放進 `data/photos/<slug>/`，檔名任意，顯示順序就是檔名排序（數字按大小排），想調順序改檔名即可，例如 `01-xxx.jpg`、`02-xxx.jpg`。
   兩個資料夾都接受 jpg、png、webp、heic，且都不進 git，原圖只留在你電腦。
   **注意是 `data/`，不是 `public/`**：`public/avatars/`、`public/photos/` 裡的檔案全部由腳本產生，手動放進去的原圖不會顯示，build 檢查也會報錯。
2. 執行 `npm run images`（內部是 `python -m uv run scripts/images/make_images.py`，uv 只要有用 pip 裝在 Python 裡就能跑，不需要在 PATH 上）。腳本會轉正、轉 sRGB、輸出 JPEG 並清掉 GPS 等 metadata：頭像置中裁成 512×512 正方形，寫到 `public/avatars/<slug>-<雜湊>.jpg`；相簿照片不裁切、長邊縮到 2400px（原圖較小就維持原尺寸），寫到 `public/photos/<slug>/<檔名>-<雜湊>.jpg`。同時更新 [`src/data/images.json`](src/data/images.json)。
3. `npm run preview` 看一下，再把 `public/avatars/`、`public/photos/` 與 `src/data/images.json` 一起 commit。

網站依 images.json 決定每個人的頭像與相簿（[`src/data/images.ts`](src/data/images.ts)），members.ts 不用填路徑。檔名帶內容雜湊，換照片時網址會跟著變，不會吃到瀏覽器或 CDN 的舊快取；不再使用的舊檔會自動刪除。有照片的人，個人頁下方會多出「照片」輪播（[`src/components/photo-carousel.tsx`](src/components/photo-carousel.tsx)）：一次一張、兩側露出前後張邊緣、可滑動或用 ‹ › 切換；點照片會開啟全螢幕放大檢視（[`src/components/photo-lightbox.tsx`](src/components/photo-lightbox.tsx)），同樣可滑動、用 ‹ › 或鍵盤左右鍵切換，按 Esc、右上角 ✕ 或點暗處關閉。

`npm run build` 之前會自動跑 [`scripts/images/check_images.mjs`](scripts/images/check_images.mjs)（本機與 Vercel 都會），忘了轉檔、清單與檔案不符、直接把幾 MB 原圖丟進 public、檔名或資料夾名不是任何 slug，build 都會失敗並提示該執行的指令。它不會替你轉檔，因為 Vercel 的 build 環境沒有影像工具，而且產出應該進 git 才能檢視。

頭像建議：正方形或接近正方形、臉在中央（會切成圓形，四角會被裁掉）、原圖 1000px 以上即可。若某張構圖偏一邊，先自己裁成正方形再放進 `data/avatars/`。相簿照片橫的直的都可以，會等比縮放置中顯示。

### 首頁文案

Hero 標語、站名、成立年份與描述在 [`src/lib/site.ts`](src/lib/site.ts)；「關於鴿友會」段落在 [`src/components/club-intro.tsx`](src/components/club-intro.tsx)。

### Logo

原始 logo 是 [`data/logo/logo.png`](data/logo/logo.png)（透明背景 PNG），名片 QR code 也從這裡取圖。網站用的三個圖檔由 [`scripts/logo/make_logo_assets.py`](scripts/logo/make_logo_assets.py) 產生，換 logo 時把新圖存成同一個路徑再跑一次：

```bash
uv run scripts/logo/make_logo_assets.py
```

| 產出 | 用途 |
|---|---|
| `src/assets/logo.png` | 網頁 logo（高 1024px），header、首頁 Hero 水印、404 頁、分享預覽圖都用這張，顯示端透過 `src/components/site-logo.tsx` |
| `src/app/icon.png` | favicon，深藍圓角底 |
| `src/app/apple-icon.png` | iOS 加到主畫面的圖示 |

## 部署

專案已連接 GitHub，推到 `main` 就會由 Vercel 自動部署。

1. 在 Vercel 專案的 **Settings → Domains** 接上自訂網域。
2. 在 **Settings → Environment Variables** 加上 `NEXT_PUBLIC_SITE_URL=https://你的網域`（Production），然後 Redeploy，讓 sitemap 與分享預覽用正確網址。
3. 網域確定後再產生名片 QR code。`*.vercel.app` 的預設網址可能會變。

## 名片 QR code

[`scripts/qr/make_qr.py`](scripts/qr/make_qr.py) 把網址編成**靜態** QR code：QR 內容就是網址本身，不經任何短網址或動態 QR 服務，只要網域持續持有、slug 不改就永久有效。需要 [uv](https://docs.astral.sh/uv/)（`winget install astral-sh.uv`，或 `pip install uv`），第一次執行會自動安裝相依套件。若 `uv` 不是可用指令（例如用 pip 裝在 pyenv 的 Python 裡），把下面所有 `uv run` 換成 `python -m uv run` 即可，本文件的 npm script 都已這樣寫。

```bash
# 單一網址
uv run scripts/qr/make_qr.py https://你的網域/members/minj --verify

# 首頁、名錄、所有鴿友個人頁一次產生（同一批統一 QR 版本，名片尺寸一致），並輸出向量 SVG
uv run scripts/qr/make_qr.py --members --base-url https://你的網域 --svg --verify

# 實測這顆 logo 能放多大：對同一網址掃過多種 logo 大小並用 zxing-cpp 解碼，報告在 out/qr/sweep/
uv run scripts/qr/make_qr.py https://你的網域/members/pistachio --sweep
```

- 輸出在 `out/qr/`（已被 git 忽略）；`manifest.json` 記錄每張 QR 編了哪個網址、版本、logo 與驗證結果。
- logo 預設取 `data/logo/` 下唯一的 PNG，透明背景直接貼在中央，方框邊長為 QR 的 22%（`--logo-ratio`，上限約 0.30）。掃描不穩時加 `--badge rounded` 墊白底，或 `--no-logo`。
- 有 logo 時容錯等級固定 H。網域 18 字元以內會落在 v5（37 模組）、32 字元以內 v6（41 模組）；再長就進入 v7，正中央會出現對位圖案，不適合放 logo。
- 列印：每模組至少 0.5 mm，v5 含留白約 22.5 mm、v6 約 24.5 mm。PNG 已寫入對應 DPI，SVG 直接標 mm。
- `--fg-texture data/material/gold.png` 用材質圖填滿模組，腳本會自動把材質亮度拉到與底色有足夠對比（`--texture-range` 可手動調）。黑底白格（`--fg "#ffffff" --bg "#000000"`）與材質都要用 `--verify` 加實機掃描確認，反相 QR 不是所有掃描器都支援。
- 只接受 `https://` 正式網域；`localhost` 會被擋、`*.vercel.app` 會警告。
- 沒有 uv 時：`pip install qrcode==8.2 pillow==12.3.0 zxing-cpp==3.1.1`（Python 3.10–3.13）再用 `python` 執行。

## 技術

Next.js 16（App Router）、Tailwind CSS v4、TypeScript。全站在建置時靜態產生，沒有資料庫。分享預覽圖由 [`src/app/opengraph-image.tsx`](src/app/opengraph-image.tsx) 在建置時產生一次。
