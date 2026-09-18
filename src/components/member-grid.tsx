import type { Member } from "@/data/members";
import { MemberCard } from "@/components/member-card";

export function MemberGrid({ members }: { members: Member[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
      {members.map((member) => (
        <MemberCard key={member.slug} member={member} />
      ))}
    </ul>
  );
}
