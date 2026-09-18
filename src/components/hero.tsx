import Link from "next/link";
import { PigeonMark } from "@/components/pigeon-mark";
import { siteDescription, siteTagline } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-5xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <p className="mb-4 text-sm font-medium tracking-[0.3em] text-accent">
          PIGEONHUB
        </p>
        <h1 className="max-w-2xl text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
          {siteTagline}
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-8 text-muted">
          {siteDescription}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/members"
            className="rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            認識鴿友
          </Link>
          <a
            href="#about"
            className="rounded-full border border-line px-6 py-3 font-medium transition-colors hover:bg-surface"
          >
            關於鴿友會
          </a>
        </div>
      </div>
      <PigeonMark className="pointer-events-none absolute -top-6 -right-10 h-72 w-72 text-primary opacity-[0.07] sm:h-96 sm:w-96" />
    </section>
  );
}
