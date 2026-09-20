# PigeonHub 鴿友會官網

一群都被會長 MinJ 放過鴿子的人組成的鴿友會。網站部署在 Vercel，包含首頁、鴿友名錄，以及每位鴿友一個固定網址的個人頁，網址可直接放進電子名片或做成 QR code。

## 網址規則

| 頁面 | 網址 |
|---|---|
| 首頁 | `/` |
| 鴿友名錄 | `/members` |
| 個人頁 | `/members/<slug>`，例如 `/members/minj` |

slug 一律小寫英數。**定案並印上名片後請勿更動**，否則 QR code 會失效。

## 本機開發

```bash
npm install
npm run dev      # 開發模式 http://localhost:3000，改檔即時更新
npm run lint     # ESLint
npm run build    # 正式建置，會產生所有靜態頁面
npm run check    # lint + build，其中 build 就是 Vercel 部署時跑的步驟
npm run preview  # check 之後以正式模式啟動 http://localhost:3100
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
| `avatar` | 頭像路徑，沒有照片時填 `PLACEHOLDER_AVATAR` |
| `highlights` | 事蹟列表：被會長放鴿子的紀錄，會長本人則是放鴿子的紀錄。每筆有 `year`（年份，選填）、`title`（標題）、`description`（補充，選填）；有年份的由新到舊排，沒年份的排最後 |

範例：

```ts
{
  slug: "kk",
  displayName: "KK",
  role: "會員",
  tagline: "被放鴿子三次仍然相信會長的人。",
  bio: "第一段自介。\n第二段自介。",
  avatar: "/avatars/kk.jpg",
  highlights: [
    { year: 2025, title: "跨年夜被放鴿子", description: "會長說在路上了，然後就沒有然後了。" },
    { year: 2024, title: "生日聚餐等了兩小時" },
  ],
},
```

### 頭像

把正方形照片（建議 512×512 以上，JPG 或 WebP）放進 [`public/avatars/`](public/avatars/)，再把該鴿友的 `avatar` 改成 `/avatars/<檔名>`。

### 首頁文案

Hero 標語、站名與描述在 [`src/lib/site.ts`](src/lib/site.ts)；「關於鴿友會」段落在 [`src/components/club-intro.tsx`](src/components/club-intro.tsx)。

## 部署

專案已連接 GitHub，推到 `main` 就會由 Vercel 自動部署。

1. 在 Vercel 專案的 **Settings → Domains** 接上自訂網域。
2. 在 **Settings → Environment Variables** 加上 `NEXT_PUBLIC_SITE_URL=https://你的網域`（Production），然後 Redeploy，讓 sitemap 與分享預覽用正確網址。
3. 網域確定後再產生名片 QR code。`*.vercel.app` 的預設網址可能會變。

## 名片 QR code

[`scripts/qr/make_qr.py`](scripts/qr/make_qr.py) 把網址編成**靜態** QR code：QR 內容就是網址本身，不經任何短網址或動態 QR 服務，只要網域持續持有、slug 不改就永久有效。需要 [uv](https://docs.astral.sh/uv/)（`winget install astral-sh.uv`），第一次執行會自動安裝相依套件。

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
