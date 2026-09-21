import { siteFoundedYear, siteName, siteTagline } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} {siteName} · Est. {siteFoundedYear}
        </p>
        <p>{siteTagline}</p>
      </div>
    </footer>
  );
}
