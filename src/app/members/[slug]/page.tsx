import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllSlugs, getMemberBySlug } from "@/data/members";
import { buildOpenGraph, siteName } from "@/lib/site";
import { MemberProfile } from "@/components/member-profile";
import { HighlightList } from "@/components/highlight-list";

type Props = {
  params: Promise<{ slug: string }>;
};

/** 只產生 members.ts 裡列出的 slug，其他網址一律 404。 */
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const member = getMemberBySlug(slug);
  if (!member) return {};

  const title = member.displayName;
  const description = `${member.role}・${member.tagline}`;
  const url = `/members/${member.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: buildOpenGraph({
      title: `${title}｜${siteName}`,
      description,
      url,
      profile: true,
    }),
  };
}

export default async function MemberPage({ params }: Props) {
  const { slug } = await params;
  const member = getMemberBySlug(slug);
  if (!member) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <Link
        href="/members"
        className="text-sm text-muted transition-colors hover:text-primary"
      >
        ← 鴿友名錄
      </Link>
      <div className="mt-6">
        <MemberProfile member={member} />
        <HighlightList
          highlights={member.highlights}
          isPlaceholder={member.isPlaceholder}
        />
      </div>
    </article>
  );
}
