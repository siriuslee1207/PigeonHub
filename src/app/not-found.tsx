import type { Metadata } from "next";
import Link from "next/link";
import { PigeonMark } from "@/components/pigeon-mark";

export const metadata: Metadata = {
  title: "找不到這一頁",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center sm:px-6">
      <PigeonMark className="h-16 w-16 text-muted" />
      <h1 className="mt-6 text-3xl font-bold tracking-tight">找不到這一頁</h1>
      <p className="mt-3 max-w-md text-muted">
        看來這一頁也被放鴿子了。請確認網址是否正確，或回到鴿友名錄找找看。
      </p>
      <Link
        href="/members"
        className="mt-8 rounded-full bg-primary px-6 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
      >
        前往鴿友名錄
      </Link>
    </div>
  );
}
