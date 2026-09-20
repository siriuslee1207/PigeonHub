import type { Highlight } from "@/data/members";

type Props = {
  highlights: Highlight[];
  isPlaceholder?: boolean;
};

export function HighlightList({ highlights, isPlaceholder }: Props) {
  // 有年份的由新到舊排序，沒有年份的排在最後（維持原本填寫順序）。
  const sorted = [...highlights].sort((a, b) => {
    if (a.year === undefined && b.year === undefined) return 0;
    if (a.year === undefined) return 1;
    if (b.year === undefined) return -1;
    return b.year - a.year;
  });

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold tracking-tight">事蹟</h2>

      {sorted.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
          {isPlaceholder ? "事蹟資料整理中，敬請期待。" : "目前尚無事蹟紀錄。"}
        </p>
      ) : (
        <ol className="mt-6 border-l-2 border-line">
          {sorted.map((item, index) => (
            <li
              key={`${item.year ?? "undated"}-${item.title}-${index}`}
              className="relative pb-8 pl-6 last:pb-0"
            >
              <span
                aria-hidden="true"
                className="absolute top-2 -left-[7px] h-3 w-3 rounded-full bg-accent ring-4 ring-background"
              />
              {item.year !== undefined && (
                <time
                  dateTime={String(item.year)}
                  className="text-sm font-medium text-accent"
                >
                  {item.year}
                </time>
              )}
              <h3 className={item.year !== undefined ? "mt-1 font-bold" : "font-bold"}>
                {item.title}
              </h3>
              {item.description && (
                <p className="mt-1 text-sm leading-7 text-muted">
                  {item.description}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
