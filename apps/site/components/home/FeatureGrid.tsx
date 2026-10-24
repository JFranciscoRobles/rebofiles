import { FEATURES, PASTEL_CLASS, pastelAt } from '@/lib/home';

/** The features as cards, each with what it does in a line or two; one not here yet says the version it comes in. */
export function FeatureGrid() {
  return (
    <ul className="reveal grid gap-3.5 grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))]">
      {FEATURES.map(([title, text, icon, comes], i) => (
        <li key={title} className="group flex gap-3.5 rounded-2xl border border-border bg-white p-4.5 transition duration-250 hover:-translate-y-1 hover:shadow-lift">
          <span className={`inline-flex size-11 flex-none items-center justify-center rounded-xl ${PASTEL_CLASS[pastelAt(i)]}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="group-hover:animate-wiggle">
              <path d={icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 flex flex-wrap items-center gap-2 font-display text-[17px] font-bold tracking-[-0.01em]">
              {title}
              {comes && <span className="rounded-full bg-surface px-2 py-0.5 font-text text-[11px] font-semibold tracking-normal text-muted">Coming in {comes}</span>}
            </h3>
            <p className="m-0 mt-1.5 text-[15px] leading-[1.55] text-muted">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
