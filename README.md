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
npm run dev      # http://localhost:3000
npm run lint     # ESLint
npm run build    # 正式建置，會產生所有靜態頁面
```

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
| `highlights` | 事蹟列表：被會長放鴿子的紀錄，會長本人則是放鴿子的紀錄 |

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

## 技術

Next.js 16（App Router）、Tailwind CSS v4、TypeScript。全站在建置時靜態產生，沒有資料庫。分享預覽圖由 [`src/app/opengraph-image.tsx`](src/app/opengraph-image.tsx) 在建置時產生一次。
