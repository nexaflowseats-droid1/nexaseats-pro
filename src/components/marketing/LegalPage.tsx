import { MarketingPage, SectionHeading } from "./SiteChrome";

export function LegalPage({
  eyebrow,
  title,
  sections,
}: {
  eyebrow: string;
  title: string;
  sections: { h: string; p: string }[];
}) {
  return (
    <MarketingPage>
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className="mt-10 space-y-8">
          {sections.map((s) => (
            <div key={s.h}>
              <h3 className="font-display text-base font-medium text-foreground">{s.h}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.p}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}
