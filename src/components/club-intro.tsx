export function ClubIntro() {
  return (
    <section id="about" className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="grid gap-6 md:grid-cols-[1fr_2fr] md:gap-10">
        <h2 className="text-2xl font-bold tracking-tight">關於鴿友會</h2>
        {/* TODO: 以下簡介為初稿，請會員們確認後修改。 */}
        <div className="space-y-4 text-base leading-8 text-foreground/90">
          <p>
            PigeonHub
            鴿友會沒有鴿子。這裡的成員只有一個共同點：都曾經約好了會長
            MinJ，然後被放鴿子。
          </p>
          <p>
            從一次遲到、一句「我快到了」，到最後直接消失，每個人都有自己的版本。我們決定把這些事蹟記錄下來，順便給每個人一張名片，提醒會長：我們都還記得。
          </p>
        </div>
      </div>
    </section>
  );
}
