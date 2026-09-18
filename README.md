# PigeonHub 鴿友會官網

鴿友會官方網站，部署在 Vercel。包含首頁、鴿友名錄，以及每位鴿友一個固定網址的個人頁，網址可直接放進電子名片或做成 QR code。

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

範例：

```ts
{
  slug: "minj",
  displayName: "MinJ",
  realName: "王小明",
  loftName: "明志鴿舍",
  location: "臺中市",
  tagline: "專攻中距離，二十年的詹森系血統。",
  bio: "第一段自介。\n第二段自介。",
  avatar: "/avatars/minj.jpg",
  highlights: [
    { year: 2024, title: "春季綜合冠軍", description: "南海賽線，三關綜合。" },
    { year: 2022, title: "秋季五關伯馬" },
  ],
},
```

### 頭像

把正方形照片（建議 512×512 以上，JPG 或 WebP）放進 [`public/avatars/`](public/avatars/)，再把該鴿友的 `avatar` 改成 `/avatars/<檔名>`。沒有照片時維持 `PLACEHOLDER_AVATAR`。

### 首頁文案

Hero 標語、站名與描述在 [`src/lib/site.ts`](src/lib/site.ts)；「關於鴿友會」段落在 [`src/components/club-intro.tsx`](src/components/club-intro.tsx)。

## 部署到 Vercel

1. 把 repo 推上 GitHub。
2. 到 [vercel.com](https://vercel.com) → **Add New → Project → Import Git Repository**，選這個 repo。Framework 會自動偵測為 Next.js，直接 **Deploy**。
3. 之後每次推到 `main` 都會自動部署；其他分支會產生預覽網址。
4. **Settings → Domains** 接上自訂網域，並在 **Settings → Environment Variables** 加上 `NEXT_PUBLIC_SITE_URL=https://你的網域`（Production），讓 sitemap 與分享預覽用正確網址。
5. 網域確定後再產生名片 QR code。`*.vercel.app` 的預設網址可能會變。

## 技術

Next.js 16（App Router）、Tailwind CSS v4、TypeScript。全站在建置時靜態產生，沒有資料庫。分享預覽圖由 [`src/app/opengraph-image.tsx`](src/app/opengraph-image.tsx) 在建置時產生一次。
