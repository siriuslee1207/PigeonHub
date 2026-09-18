import type { Metadata } from "next";
import { getAllMembers } from "@/data/members";
import { buildOpenGraph, siteName } from "@/lib/site";
import { MemberGrid } from "@/components/member-grid";

const title = "鴿友名錄";
const description = `${siteName}全體會員名錄。點選卡片查看每位鴿友的介紹，以及被會長放鴿子的事蹟。`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/members" },
  openGraph: buildOpenGraph({
    title: `${title}｜${siteName}`,
    description,
    url: "/members",
  }),
};

export default function MembersPage() {
  const members = getAllMembers();
  const presidentCount = members.filter((m) => m.role === "會長").length;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-muted">
          共 {members.length} 位鴿友，其中 {presidentCount}{" "}
          位是會長，其他都被會長放過鴿子。
        </p>
      </header>
      <MemberGrid members={members} />
    </div>
  );
}
