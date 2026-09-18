import Link from "next/link";
import type { Member } from "@/data/members";
import { MemberAvatar } from "@/components/member-avatar";

export function MemberCard({ member }: { member: Member }) {
  const isPresident = member.role === "會長";

  return (
    <li>
      <Link
        href={`/members/${member.slug}`}
        className="group flex h-full flex-col items-center rounded-2xl border border-line bg-surface p-5 text-center transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      >
        <MemberAvatar
          src={member.avatar}
          alt={`${member.displayName} 的頭像`}
          size={96}
          className="h-20 w-20 sm:h-24 sm:w-24"
        />
        <h3 className="mt-4 text-lg font-bold transition-colors group-hover:text-primary">
          {member.displayName}
        </h3>
        <p
          className={`mt-1 text-sm ${
            isPresident ? "font-medium text-accent" : "text-muted"
          }`}
        >
          {member.role}
        </p>
      </Link>
    </li>
  );
}
