import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { siteName } from "@/lib/site";

const navItems = [
  { href: "/", label: "首頁" },
  { href: "/members", label: "鴿友名錄" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold tracking-tight text-foreground"
        >
          <SiteLogo height={36} className="h-9 w-auto" priority />
          <span>{siteName}</span>
        </Link>
        <nav aria-label="主選單" className="flex items-center gap-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-1.5 transition-colors hover:bg-surface hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
