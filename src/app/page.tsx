import type { Metadata } from "next";
import Link from "next/link";
import { getAllMembers } from "@/data/members";
import { buildOpenGraph, siteDescription, siteName } from "@/lib/site";
import { Hero } from "@/components/hero";
import { ClubIntro } from "@/components/club-intro";
import { MemberGrid } from "@/components/member-grid";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: buildOpenGraph({
    title: siteName,
    description: siteDescription,
    url: "/",
  }),
};

export default function HomePage() {
  const members = getAllMembers();

  return (
    <>
      <Hero />
      <ClubIntro />
      <section id="members" className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">鴿友名錄</h2>
          <Link
            href="/members"
            className="text-sm text-primary hover:underline"
          >
            查看全部
          </Link>
        </div>
        <MemberGrid members={members} />
      </section>
    </>
  );
}
