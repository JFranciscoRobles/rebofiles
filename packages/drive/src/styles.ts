// How the drive looks, as one stylesheet scoped to `.rf-drive`. Its colours,
// radii and fonts are custom properties: an application changes them on the
// element, or on a class of its own, and leaves the rest. The values are the
// suite's (Rebodocs' neutrals and pastels) with ReboFiles' emerald; the dark
// ones, for `theme="dark"` or `"auto"` on a dark system, are the same pairs
// made light on dark, each read at 4.5:1 or more as the light ones are.

/** The colours that change with the theme, dark. */
const DARK = `
  --rf-brand: #4cc995; --rf-brand-hover: #74d8ad; --rf-brand-light: #17382a; --rf-focus: #2f8a62; --rf-on-brand: #0d1f17;
  --rf-docs: #8ab4f8; --rf-docs-hover: #aecbfa; --rf-on-docs: #0d1a2e;
  --rf-ink: #ecebe7; --rf-ink-soft: #d2d0ca; --rf-muted: #a9a69f; --rf-faint: #6f6c66;
  --rf-surface: #161514; --rf-hover: #2a2926; --rf-border: #33312d; --rf-border-strong: #46433d; --rf-divider: #2a2926;
  --rf-danger: #f29a8c; --rf-danger-light: #3f221e; --rf-bg: #1f1e1c;
  --rf-shade: 0,0,0; --rf-toast: #ecebe7; --rf-on-toast: #1f1e1c; --rf-drop: rgba(23,56,42,.94);
  --rf-k-folder: #3a2f12; --rf-k-folder-fg: #f0c55a; --rf-k-docx: #172a4a; --rf-k-docx-fg: #9cc0fa;
  --rf-k-pdf: #3d1f2b; --rf-k-pdf-fg: #f3a9c3; --rf-k-sheet: #1b3322; --rf-k-sheet-fg: #93d4a2;
  --rf-k-image: #2b2340; --rf-k-image-fg: #c8afef; --rf-k-text: #3d2817; --rf-k-text-fg: #f2b483;
  --rf-k-video: #14343a; --rf-k-video-fg: #86d0dc; --rf-k-audio: #1f2444; --rf-k-audio-fg: #aab4f2;
  color-scheme: dark;
`;

export const CSS = `
.rf-drive {
  --rf-brand: #0e7c52; --rf-brand-hover: #095c3c; --rf-brand-light: #e3f4ea; --rf-focus: #8fd3ae;
  --rf-docs: #0b57d0; --rf-docs-hover: #08398a;
  --rf-ink: #2f2e2b; --rf-ink-soft: #4a4843; --rf-muted: #6b6964; --rf-faint: #9b9890;
  --rf-surface: #f7f6f3; --rf-hover: #f1f0ec; --rf-border: #eae8e3; --rf-border-strong: #dddad3; --rf-divider: #f0eee9;
  --rf-danger: #b13a2a; --rf-danger-light: #fbe8ef; --rf-bg: #fff; --rf-on-brand: #fff; --rf-on-docs: #fff;
  --rf-shade: 47,46,43; --rf-toast: #2f2e2b; --rf-on-toast: #fff; --rf-drop: rgba(227,244,234,.92);
  --rf-k-folder: #fbf3db; --rf-k-folder-fg: #c58a12; --rf-k-docx: #e8f0fd; --rf-k-docx-fg: #0b57d0;
  --rf-k-pdf: #fbe8ef; --rf-k-pdf-fg: #a23a5e; --rf-k-sheet: #e7f3ea; --rf-k-sheet-fg: #2e6b3c;
  --rf-k-image: #f0ebf8; --rf-k-image-fg: #6a4a9c; --rf-k-text: #fcebdd; --rf-k-text-fg: #a4521c;
  --rf-k-video: #e6f4f6; --rf-k-video-fg: #0e6672; --rf-k-audio: #eef0fb; --rf-k-audio-fg: #3d4aa8;
  color-scheme: light;
  --rf-font: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --rf-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --rf-radius: 14px;
  --rf-shadow-menu: 0 16px 36px rgba(var(--rf-shade),.14);
  display: flex; flex-direction: column; min-height: 0; height: 100%;
  font: 14px/1.45 var(--rf-font); color: var(--rf-ink); background: var(--rf-bg);
  border: 1px solid var(--rf-border); border-radius: var(--rf-radius); overflow: hidden; position: relative;
}
.rf-drive *, .rf-drive *::before, .rf-drive *::after { box-sizing: border-box; }
.rf-drive button { font: inherit; color: inherit; cursor: pointer; }
.rf-drive :focus-visible { outline: 3px solid var(--rf-focus); outline-offset: 2px; }
.rf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

.rf-top { display: flex; align-items: center; gap: 16px; padding: 10px 16px; border-bottom: 1px solid var(--rf-border); }
.rf-title { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; white-space: nowrap; min-width: 194px; }
.rf-search { flex: 1; max-width: 560px; display: flex; align-items: center; gap: 8px; padding: 0 14px; height: 40px; border-radius: 999px; background: var(--rf-hover); color: var(--rf-muted); }
.rf-search:focus-within { background: var(--rf-bg); box-shadow: 0 0 0 1px var(--rf-border-strong), 0 2px 8px rgba(var(--rf-shade),.08); }
.rf-search input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; color: var(--rf-ink); outline: none; }
.rf-search button { border: 0; background: none; display: grid; place-items: center; padding: 4px; border-radius: 999px; color: var(--rf-muted); }

.rf-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 210px minmax(0,1fr) 290px; gap: 12px; padding: 12px; background: var(--rf-surface); }
.rf-side { display: flex; flex-direction: column; gap: 4px; min-height: 0; }
.rf-new { display: flex; align-items: center; gap: 10px; padding: 12px 18px; margin-bottom: 8px; border: 0; border-radius: 14px; background: var(--rf-bg); font-weight: 600;
  box-shadow: 0 1px 3px rgba(var(--rf-shade),.12), 0 4px 12px rgba(var(--rf-shade),.08); transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s; align-self: flex-start; }
.rf-new:hover { transform: translateY(-2px); box-shadow: 0 2px 6px rgba(var(--rf-shade),.12), 0 10px 22px rgba(var(--rf-shade),.1); }
.rf-new svg { color: var(--rf-brand); }
.rf-menu { position: absolute; z-index: 5; margin-top: 50px; min-width: 190px; padding: 6px; border-radius: 12px; background: var(--rf-bg); box-shadow: var(--rf-shadow-menu); border: 1px solid var(--rf-border); }
.rf-menu button { display: flex; width: 100%; align-items: center; gap: 10px; padding: 8px 10px; border: 0; background: none; border-radius: 8px; text-align: left; }
.rf-menu button:hover, .rf-menu button:focus-visible { background: var(--rf-hover); }
.rf-menu.rf-ctx { margin-top: 0; z-index: 16; min-width: 210px; }
.rf-menu button.rf-danger { color: var(--rf-danger); }
.rf-menu button svg { flex: none; }
.rf-nav { display: flex; align-items: center; gap: 12px; padding: 8px 14px; border: 0; border-radius: 999px; background: none; text-align: left; color: var(--rf-ink-soft); }
.rf-nav:hover { background: var(--rf-hover); }
.rf-nav[aria-current='true'] { background: var(--rf-brand-light); color: var(--rf-brand); font-weight: 600; }
.rf-activity { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; font-size: 13px; }
.rf-activity li { display: flex; flex-direction: column; gap: 2px; }
.rf-activity small { color: var(--rf-ink-soft); }
.rf-badge { margin-left: auto; min-width: 20px; padding: 0 6px; border-radius: 999px; background: var(--rf-brand); color: var(--rf-on-brand); font-size: 12px; font-weight: 600; line-height: 20px; text-align: center; }
.rf-nav.rf-drop { box-shadow: inset 0 0 0 2px var(--rf-brand); }
.rf-usage { display: flex; flex-direction: column; gap: 6px; margin: auto 12px 10px; font-size: 12px; color: var(--rf-muted); }
.rf-usage .rf-bar { width: 100%; }
.rf-bar.rf-full span { background: var(--rf-danger); }
.rf-storage { margin-top: auto; padding: 12px 14px; font-size: 12px; color: var(--rf-muted); }
.rf-storage code { display: block; margin-top: 4px; font: 11px var(--rf-mono); color: var(--rf-muted); overflow: hidden; text-overflow: ellipsis; }

.rf-main, .rf-details { background: var(--rf-bg); border: 1px solid var(--rf-border); border-radius: var(--rf-radius); min-height: 0; display: flex; flex-direction: column; }
.rf-main { position: relative; }
.rf-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 10px 8px; min-height: 56px; }
.rf-crumbs { display: flex; align-items: center; gap: 2px; flex: 1; min-width: 0; overflow: hidden; }
.rf-crumb { border: 0; background: none; padding: 4px 10px; border-radius: 999px; font-size: 18px; font-weight: 500; white-space: nowrap; color: var(--rf-ink-soft); }
.rf-crumb:hover { background: var(--rf-hover); }
.rf-crumb:last-child { color: var(--rf-ink); }
.rf-crumb.rf-drop { box-shadow: inset 0 0 0 2px var(--rf-brand); }
.rf-crumbs > svg { color: var(--rf-faint); flex: none; }
.rf-seg { display: flex; border: 1px solid var(--rf-border-strong); border-radius: 999px; overflow: hidden; flex: none; }
.rf-seg button { display: grid; place-items: center; width: 38px; height: 32px; border: 0; background: none; color: var(--rf-muted); }
.rf-seg button[aria-pressed='true'] { background: var(--rf-brand-light); color: var(--rf-brand); }
.rf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--rf-border-strong); background: var(--rf-bg); font-weight: 500; white-space: nowrap; }
.rf-btn:hover { background: var(--rf-hover); }
.rf-btn:disabled { opacity: .5; cursor: default; }
.rf-btn.rf-primary { background: var(--rf-brand); border-color: var(--rf-brand); color: var(--rf-on-brand); font-weight: 600; }
.rf-btn.rf-primary:hover { background: var(--rf-brand-hover); }
.rf-btn.rf-docs { background: var(--rf-docs); border-color: var(--rf-docs); color: var(--rf-on-docs); font-weight: 600; }
.rf-btn.rf-docs:hover { background: var(--rf-docs-hover); }
.rf-btn.rf-text { border-color: transparent; background: none; }
.rf-btn.rf-danger { color: var(--rf-danger); }
.rf-btn.rf-danger:hover { background: var(--rf-danger-light); }

.rf-items { flex: 1; min-height: 0; overflow: auto; outline: none; }
.rf-items:focus-visible { box-shadow: inset 0 0 0 3px var(--rf-focus); }
.rf-cols, .rf-row { display: grid; grid-template-columns: minmax(0,1fr) 90px 110px 80px; gap: 12px; align-items: center; padding: 9px 16px; }
.rf-cols { position: sticky; top: 0; z-index: 1; background: var(--rf-bg); font-size: 12px; font-weight: 500; color: var(--rf-muted); border-bottom: 1px solid var(--rf-divider); }
.rf-col { all: unset; box-sizing: border-box; display: inline-flex; align-items: center; gap: 4px; min-width: 0; cursor: pointer; border-radius: 6px; color: inherit; }
.rf-col:hover { color: var(--rf-ink); }
.rf-col:focus-visible { box-shadow: 0 0 0 3px var(--rf-focus); }
.rf-col.rf-on { color: var(--rf-ink); font-weight: 600; }
.rf-sort-dir { font-size: 11px; }
.rf-head .rf-select { max-width: 160px; }
.rf-row { border-bottom: 1px solid var(--rf-divider); cursor: default; user-select: none; color: var(--rf-ink-soft); font-size: 13px; }
.rf-row:hover { background: var(--rf-surface); }
.rf-row[aria-selected='true'] { background: var(--rf-brand-light); }
.rf-row.rf-active { box-shadow: inset 3px 0 0 var(--rf-brand); }
.rf-items:focus-visible [data-current='true'] { box-shadow: inset 0 0 0 2px var(--rf-brand); }
/* A box to tick each one: seen on the one under the mouse, and on all while several are picked. */
.rf-tick { flex: none; display: grid; place-items: center; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--rf-border-strong); background: var(--rf-bg); color: transparent; cursor: pointer; }
.rf-row .rf-tick { width: 0; border-width: 0; margin-right: -12px; overflow: hidden; transition: width .12s, margin .12s; }
.rf-row:hover .rf-tick, [data-picking='true'] .rf-row .rf-tick, .rf-row[aria-selected='true'] .rf-tick { width: 18px; border-width: 1.5px; margin-right: 0; }
[aria-selected='true'] > * > .rf-tick, [aria-selected='true'] > .rf-tick { background: var(--rf-brand); border-color: var(--rf-brand); color: var(--rf-on-brand); }
.rf-thumb { position: relative; }
.rf-thumb .rf-tick { position: absolute; top: 8px; left: 8px; z-index: 2; opacity: 0; transition: opacity .12s; }
.rf-card:hover .rf-thumb .rf-tick, [data-picking='true'] .rf-thumb .rf-tick, .rf-card[aria-selected='true'] .rf-thumb .rf-tick { opacity: 1; }
.rf-head.rf-picking { gap: 6px; background: var(--rf-brand-light); border-radius: 12px; margin: 6px 8px 0; padding: 6px 10px; min-height: 48px; }
.rf-picked-count { font-size: 14px; color: var(--rf-ink); white-space: nowrap; }
@media (max-width: 700px) { .rf-picking .rf-btn-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; } .rf-picking .rf-btn.rf-small { padding: 7px; } }
.rf-grow { flex: 1; }
.rf-btn.rf-small { padding: 6px 10px; font-size: 13px; }
.rf-btn.rf-icon { padding: 6px; border-color: transparent; background: none; }
.rf-stack { position: relative; }
.rf-stack-card { position: absolute; top: 50%; left: 50%; display: grid; place-items: center; width: 64px; height: 80px; border-radius: 10px; background: var(--rf-bg); border: 1px solid var(--rf-border); box-shadow: 0 4px 12px rgba(var(--rf-shade),.1); transform: translate(calc(-50% + (var(--rf-i) - 1) * 26px), -50%) rotate(calc((var(--rf-i) - 1) * 7deg)); }
.rf-picked-list { list-style: none; margin: 12px 0 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--rf-ink-soft); }
.rf-picked-list li { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rf-picked-list li span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-row.rf-drop, .rf-card.rf-drop { box-shadow: inset 0 0 0 2px var(--rf-brand); }
.rf-name { display: flex; align-items: center; gap: 12px; min-width: 0; color: var(--rf-ink); font-size: 14px; font-weight: 500; }
.rf-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-tile { flex: none; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 8.5px; font-weight: 700; letter-spacing: .02em; }
.rf-k-folder { background: var(--rf-k-folder); color: var(--rf-k-folder-fg); }
.rf-k-docx { background: var(--rf-k-docx); color: var(--rf-k-docx-fg); }
.rf-k-pdf { background: var(--rf-k-pdf); color: var(--rf-k-pdf-fg); }
.rf-k-sheet { background: var(--rf-k-sheet); color: var(--rf-k-sheet-fg); }
.rf-k-video { background: var(--rf-k-video); color: var(--rf-k-video-fg); }
.rf-k-audio { background: var(--rf-k-audio); color: var(--rf-k-audio-fg); }
.rf-k-image { background: var(--rf-k-image); color: var(--rf-k-image-fg); }
.rf-k-text, .rf-k-other { background: var(--rf-k-text); color: var(--rf-k-text-fg); }
.rf-k-folder svg { fill: currentColor; }

.rf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; padding: 4px 12px 12px; }
.rf-card { border-radius: 14px; background: var(--rf-surface); border: 1px solid transparent; padding: 8px; cursor: default; user-select: none; transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s; }
.rf-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(var(--rf-shade),.1); }
.rf-card[aria-selected='true'] { background: var(--rf-brand-light); border-color: var(--rf-focus); }
.rf-thumb { height: 96px; border-radius: 10px; display: grid; place-items: center; margin-bottom: 8px; overflow: hidden; }
.rf-thumb img { width: 100%; height: 100%; object-fit: cover; }
.rf-card .rf-name { font-size: 13px; gap: 8px; padding: 0 4px 2px; }
.rf-card .rf-tile { width: 22px; height: 22px; border-radius: 6px; font-size: 7px; }

.rf-empty { display: grid; place-items: center; text-align: center; padding: 48px 24px; color: var(--rf-muted); }
.rf-empty svg { color: var(--rf-faint); margin-bottom: 10px; }
.rf-dropzone { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; border-radius: var(--rf-radius); background: var(--rf-drop); border: 2px dashed var(--rf-brand); color: var(--rf-brand); font-weight: 600; font-size: 16px; pointer-events: none; }

.rf-details { overflow: auto; }
.rf-details-in { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.rf-details h2 { margin: 0; font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.rf-none { padding: 24px 16px; color: var(--rf-muted); }
.rf-doc-thumb { position: absolute; inset: 0; overflow: hidden; background: #fff; }
/* The top of the page, centred, most of its side margins left out (a tenth of it each side, as most documents have more): about half of it shows. */
/* Over the rules of pictures in a preview and in a card, which fill their box. */
.rf-doc-thumb img.rf-doc-pic { position: absolute; left: 50%; top: -1%; width: 122%; max-width: none; height: auto; max-height: none; object-fit: initial; transform: translateX(-50%); border-radius: 0; }
.rf-doc-thumb.rf-fit-page img.rf-doc-pic { left: 0; top: 0; width: 100%; height: 100%; object-fit: contain; transform: none; }
.rf-doc-thumb.rf-wide { background: none; }
.rf-doc-thumb.rf-wide img.rf-doc-pic { left: 4%; top: 4%; width: 92%; height: 92%; filter: drop-shadow(0 1px 3px rgba(var(--rf-shade),.22)); }
.rf-doc-thumb .dx-page { box-shadow: 0 1px 3px rgba(var(--rf-shade),.18); pointer-events: none; }
.rf-thumb .rf-doc-thumb { inset: 8px 10px 0; border-radius: 6px 6px 0 0; }
.rf-preview.rf-preview-doc { position: relative; height: 240px; }
.rf-preview-doc .rf-doc-thumb { inset: 12px 12px 0; border-radius: 6px 6px 0 0; }
.rf-preview { height: 150px; border-radius: 12px; background: var(--rf-surface); display: grid; place-items: center; overflow: hidden; border: 1px solid var(--rf-border); }
.rf-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
/* A page is paper in either theme, with the ink of paper. */
.rf-preview iframe { width: 100%; height: 100%; border: 0; background: #fff; }
.rf-preview pre { align-self: stretch; justify-self: stretch; margin: 0; padding: 10px 12px; font: 11px/1.5 var(--rf-mono); color: var(--rf-ink-soft); white-space: pre-wrap; overflow: hidden; background: var(--rf-bg); }
.rf-page { align-self: stretch; width: 74%; justify-self: center; margin-top: 14px; padding: 12px 14px; background: #fff; border-radius: 4px 4px 0 0; box-shadow: 0 2px 10px rgba(var(--rf-shade),.12); overflow: hidden; font-size: 6.5px; line-height: 1.5; color: #4a4843; }
.rf-page strong { display: block; font-size: 9px; color: #2f2e2b; margin-bottom: 5px; }
.rf-page p { margin: 0 0 4px; }
.rf-preview .rf-tile { width: 56px; height: 56px; border-radius: 14px; font-size: 13px; }
.rf-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.rf-actions .rf-wide { flex: 1 1 100%; }
.rf-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--rf-divider); padding-bottom: 8px; }
.rf-tabs button { border: 0; background: none; padding: 6px 12px; border-radius: 8px; font-weight: 500; color: var(--rf-muted); }
.rf-tabs button[aria-selected='true'] { background: var(--rf-hover); color: var(--rf-ink); }
.rf-props { display: grid; grid-template-columns: 72px 1fr; gap: 8px 10px; margin: 0; font-size: 13px; }
.rf-props dt { color: var(--rf-muted); }
.rf-props dd { margin: 0; overflow-wrap: anywhere; }
.rf-props code { font: 11px var(--rf-mono); color: var(--rf-ink-soft); }
.rf-versions { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rf-versions li { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; font-size: 13px; }
.rf-versions li.rf-now { background: var(--rf-brand-light); }
.rf-versions .rf-v { flex: 1; min-width: 0; }
.rf-versions small { display: block; color: var(--rf-muted); }
.rf-chip { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: var(--rf-bg); color: var(--rf-brand); }
.rf-drive .rf-link { border: 0; background: none; color: var(--rf-brand); font-weight: 600; padding: 2px 4px; border-radius: 6px; }
.rf-drive .rf-link:hover { text-decoration: underline; }

.rf-status { display: flex; align-items: center; gap: 12px; padding: 7px 16px; border-top: 1px solid var(--rf-border); font-size: 12px; color: var(--rf-muted); }
.rf-status .rf-grow { flex: 1; }
.rf-bar { width: 140px; height: 6px; border-radius: 999px; background: var(--rf-hover); overflow: hidden; }
.rf-bar span { display: block; height: 100%; background: var(--rf-brand); transition: width .18s; }
.rf-error { color: var(--rf-danger); }
.rf-retry { font: inherit; font-weight: 600; color: var(--rf-ink); background: var(--rf-bg); border: 1px solid var(--rf-border-strong); border-radius: 8px; padding: 2px 10px; cursor: pointer; }
.rf-retry:hover { background: var(--rf-hover); }

.rf-toast { position: absolute; left: 50%; bottom: 44px; transform: translateX(-50%); z-index: 6; background: var(--rf-toast); color: var(--rf-on-toast); font-size: 14px; border-radius: 12px; padding: 12px 18px; box-shadow: var(--rf-shadow-menu); max-width: calc(100% - 32px); animation: rf-pop .5s cubic-bezier(.2,.8,.2,1); }
.rf-toast { display: flex; align-items: center; gap: 14px; }
.rf-toast-undo { all: unset; cursor: pointer; font-weight: 700; color: var(--rf-brand-light); padding: 2px 6px; border-radius: 6px; }
.rf-toast-undo:hover { text-decoration: underline; }
.rf-toast-undo:focus-visible { box-shadow: 0 0 0 2px var(--rf-brand-light); }
@keyframes rf-pop { from { opacity: 0; transform: translate(-50%, 8px); } }

.rf-dialog { border: 0; padding: 0; border-radius: 16px; box-shadow: var(--rf-shadow-menu); width: min(420px, calc(100vw - 32px)); color: var(--rf-ink); background: var(--rf-bg); font: 14px/1.45 var(--rf-font); }
.rf-dialog::backdrop { background: rgba(var(--rf-shade),.4); }
.rf-dialog form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.rf-dialog h2 { margin: 0; font-size: 18px; font-weight: 700; }
.rf-dialog input[type='text'], .rf-dialog input[type='password'], .rf-pass input { font: inherit; background: var(--rf-bg); color: inherit; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--rf-border-strong); outline: none; }
.rf-dialog input[type='text']:focus, .rf-dialog input[type='password']:focus, .rf-pass input:focus { border-color: var(--rf-brand); box-shadow: 0 0 0 3px var(--rf-focus); }
.rf-dialog .rf-row-end { display: flex; justify-content: flex-end; gap: 8px; }
.rf-folders { list-style: none; margin: 0; padding: 0; max-height: 260px; overflow: auto; border: 1px solid var(--rf-border); border-radius: 12px; }
.rf-folders button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; border: 0; background: none; text-align: left; border-bottom: 1px solid var(--rf-divider); font: inherit; color: inherit; cursor: pointer; }
.rf-folders button:hover { background: var(--rf-surface); }
.rf-folders button:disabled { color: var(--rf-faint); cursor: default; }
.rf-dialog .rf-sub { margin: 4px 0 -6px; font-size: 13px; font-weight: 600; color: var(--rf-muted); }
.rf-dialog .rf-hint { margin: 0; color: var(--rf-muted); font-size: 13px; }
.rf-dialog .rf-link { align-self: flex-start; cursor: pointer; font: inherit; font-weight: 600; }
.rf-shares { list-style: none; margin: 0; padding: 0; border: 1px solid var(--rf-border); border-radius: 12px; }
.rf-shares li { display: flex; align-items: center; gap: 8px; padding: 8px 10px 8px 12px; border-bottom: 1px solid var(--rf-divider); min-width: 0; }
.rf-shares li:last-child { border-bottom: 0; }
.rf-shares .rf-grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-share-add { display: flex; gap: 8px; }
.rf-share-add input[type='text'] { flex: 1; min-width: 0; }
.rf-link-add { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 8px 0; }
.rf-link-add input[type='password'] { flex: 1; min-width: 140px; }
.rf-tag { display: inline-block; margin-left: 8px; padding: 0 6px; border-radius: 999px; font-size: 12px; background: var(--rf-hover); color: var(--rf-text); }
.rf-check { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; }
.rf-pass { display: flex; flex-direction: column; gap: 10px; max-width: 320px; margin: 48px auto; }
.rf-select { font: inherit; font-size: 13px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--rf-border-strong); background: var(--rf-bg); color: inherit; }
.rf-gear { margin-left: auto; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 10px; border: 0; background: none; color: var(--rf-muted); cursor: pointer; }
.rf-gear:hover { background: var(--rf-hover); color: var(--rf-ink); }
.rf-gear:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--rf-focus); }
/* The uploads: a card at the foot of the drive, each file going up with how far it is and how long it has left. */
.rf-ups { position: absolute; right: 16px; bottom: 44px; z-index: 15; width: min(380px, calc(100% - 32px)); max-height: min(60%, 460px); display: flex; flex-direction: column; background: var(--rf-bg); border: 1px solid var(--rf-border); border-radius: 14px; box-shadow: var(--rf-shadow-menu); overflow: hidden; }
.rf-ups-head { display: flex; align-items: center; gap: 4px; padding: 10px 8px 10px 14px; border-bottom: 1px solid var(--rf-divider); }
.rf-ups-title { flex: 1; min-width: 0; font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-ups-fold svg { transform: rotate(90deg); transition: transform .15s; }
.rf-ups-fold.rf-open svg { transform: rotate(-90deg); }
.rf-ups-bar { display: block; width: auto; margin: 0; border-radius: 0; height: 3px; }
.rf-ups-list { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; }
.rf-up { display: flex; align-items: center; gap: 10px; padding: 7px 10px 7px 14px; }
.rf-up-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.rf-up-name { font-size: 13px; font-weight: 500; color: var(--rf-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-up-state { font-size: 12px; color: var(--rf-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.rf-up-failed .rf-up-state { color: var(--rf-danger); white-space: normal; }
.rf-up .rf-bar { display: block; width: auto; height: 4px; margin: 0; }
.rf-up-ok { color: var(--rf-brand); display: grid; }
.rf-up-stop { padding: 4px; color: var(--rf-muted); }

/* The viewer: a file shown whole over the drive, dark around it as a light table is. */
.rf-view { position: absolute; inset: 0; z-index: 19; display: flex; flex-direction: column; background: #161514; color: #ecebe7; border-radius: inherit; overflow: hidden; outline: none; animation: rf-set-in .16s ease-out; }
.rf-view-bar { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.08); }
.rf-view .rf-btn.rf-icon { color: #ecebe7; border-radius: 10px; }
.rf-view .rf-btn.rf-icon:hover { background: rgba(255,255,255,.1); }
.rf-view :focus-visible { outline: none; box-shadow: 0 0 0 3px #8fd3ae; }
.rf-view-title { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.rf-view-title strong { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-view-title span { font-size: 12px; color: #a9a69f; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-view-count { font-size: 13px; color: #a9a69f; white-space: nowrap; }
.rf-view-stage { position: relative; flex: 1; min-height: 0; display: flex; }
.rf-view-content { flex: 1; min-width: 0; display: flex; }
.rf-view-content > * { flex: 1; min-width: 0; }
.rf-view-step { position: absolute; top: 50%; z-index: 2; display: grid; place-items: center; width: 44px; height: 44px; margin-top: -22px; border: 0; border-radius: 50%; background: rgba(22,21,20,.72); color: #ecebe7; cursor: pointer; opacity: .75; transition: opacity .12s; }
.rf-view-step:hover, .rf-view-step:focus-visible { opacity: 1; background: rgba(60,58,54,.9); }
.rf-view-prev { left: 12px; }
.rf-view-next { right: 12px; }
.rf-view-wait, .rf-view-none { display: grid; place-items: center; align-content: center; gap: 14px; color: #a9a69f; text-align: center; padding: 24px; }
.rf-view-none p { margin: 0; }
.rf-tile.rf-tile-big { width: 88px; height: 104px; border-radius: 14px; font-size: 16px; }
/* A picture whole in the screen, however tall or wide: never a scroll, unless its real size is asked for. */
.rf-view-image { position: relative; overflow: hidden; }
.rf-view-image img { position: absolute; inset: 16px 68px; width: calc(100% - 136px); height: calc(100% - 32px); object-fit: contain; cursor: zoom-in; filter: drop-shadow(0 10px 30px rgba(0,0,0,.45)); }
.rf-view-image.rf-zoomed { overflow: auto; }
.rf-view-image.rf-zoomed img { position: static; display: block; margin: 0 auto; width: auto; height: auto; max-width: none; cursor: zoom-out; }
.rf-view-pdf { border: 0; background: #fff; }
.rf-view-video { max-width: 100%; max-height: 100%; background: #000; align-self: center; }
.rf-view-audio { display: grid; place-items: center; align-content: center; gap: 22px; }
.rf-view-audio audio { width: min(480px, 90%); }
.rf-view-doc, .rf-view-code, .rf-view-table, .rf-view-pages { overflow: auto; padding: 24px 68px; }
.rf-view-sheet { max-width: 760px; margin: 0 auto; padding: 56px 64px; background: #fff; color: #2f2e2b; border-radius: 4px; box-shadow: 0 10px 40px rgba(0,0,0,.4); font: 15px/1.65 var(--rf-font); }
.rf-view-sheet h1 { font-size: 26px; margin: 0 0 18px; }
.rf-md h1, .rf-md h2, .rf-md h3 { line-height: 1.25; margin: 1.4em 0 .5em; }
.rf-md > :first-child { margin-top: 0; }
.rf-md code { font: .9em var(--rf-mono); background: #f1f0ec; padding: 1px 5px; border-radius: 5px; }
.rf-md pre { background: #f7f6f3; border: 1px solid #eae8e3; padding: 12px 14px; border-radius: 10px; overflow: auto; }
.rf-md pre code { background: none; padding: 0; }
.rf-md blockquote { margin: 1em 0; padding: 2px 16px; border-left: 3px solid #dddad3; color: #4a4843; }
.rf-md a { color: #0b57d0; }
.rf-md hr { border: 0; border-top: 1px solid #eae8e3; margin: 1.6em 0; }
.rf-view-code pre { margin: 0 auto; max-width: 1000px; padding: 18px 20px; background: #1f1e1c; border: 1px solid #33312d; border-radius: 12px; color: #ecebe7; font: 13px/1.6 var(--rf-mono); white-space: pre-wrap; word-break: break-word; }
.rf-view-table table { margin: 0 auto; border-collapse: collapse; background: #fff; color: #2f2e2b; font-size: 13px; border-radius: 8px; overflow: hidden; }
.rf-view-table th, .rf-view-table td { padding: 7px 12px; border: 1px solid #eae8e3; text-align: left; white-space: nowrap; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.rf-view-table th { position: sticky; top: 0; background: #f1f0ec; font-weight: 600; }
.rf-view-cut { text-align: center; color: #a9a69f; font-size: 13px; margin: 14px 0 0; }
.rf-view-pages { position: relative; padding: 0; background: #2a2926; }
/* Rebodocs' bar of the zoom, floating at the foot of the pages. */
.rf-doc-zoom { position: sticky; bottom: 14px; z-index: 3; display: flex; justify-content: center; pointer-events: none; margin-top: -52px; height: 52px; align-items: center; }
.rf-doc-zoom .dx-sb { background: none; border: 0; box-shadow: none; }
/* Only read: no caret, though the bar gives the editor the keyboard back. */
.rf-view-pages .dx-caret { display: none !important; }
@media (max-width: 700px) {
  .rf-view-doc, .rf-view-code, .rf-view-table { padding: 12px; }
  .rf-view-image img { inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); }
  .rf-view-sheet { padding: 28px 22px; }
  .rf-view-step { top: auto; bottom: 14px; margin: 0; }
  .rf-view-bar { flex-wrap: wrap; }
  .rf-view-count { display: none; }
}

/* The settings: a screen of their own over the drive, the parts down one side and each one, larger, beside. */
.rf-drive { position: relative; }
.rf-set { position: absolute; inset: 0; z-index: 20; display: flex; background: var(--rf-surface); color: var(--rf-ink); border-radius: inherit; overflow: hidden; animation: rf-set-in .18s ease-out; }
@keyframes rf-set-in { from { opacity: 0; transform: scale(1.01); } }
.rf-set-nav { flex: none; display: flex; flex-direction: column; gap: 2px; width: 248px; padding: 18px 14px; border-right: 1px solid var(--rf-border); overflow-y: auto; }
.rf-set button { font: inherit; color: inherit; cursor: pointer; }
.rf-set :focus-visible { outline: none; box-shadow: 0 0 0 3px var(--rf-focus); }
.rf-set-back { display: flex; align-items: center; gap: 8px; height: 38px; margin-bottom: 14px; padding: 0 10px; border: 0; border-radius: 10px; background: none; font-weight: 600; }
.rf-set-back:hover, .rf-set-tab:hover, .rf-set-x:hover { background: var(--rf-hover); }
.rf-set-tabs { display: contents; }
.rf-set-tab { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 12px; border: 0; border-radius: 10px; background: none; text-align: left; font-size: 14px; }
.rf-set-tab svg { color: var(--rf-muted); }
.rf-set-tab[aria-selected='true'] { background: var(--rf-bg); color: var(--rf-brand); font-weight: 600; box-shadow: 0 1px 3px rgba(var(--rf-shade),.12); }
.rf-set-tab[aria-selected='true'] svg { color: var(--rf-brand); }
.rf-set-card { margin-top: auto; display: flex; flex-direction: column; gap: 2px; padding: 12px; border-radius: 12px; background: var(--rf-bg); border: 1px solid var(--rf-border); }
.rf-set-card strong { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-set-card span { font: 12px var(--rf-mono); color: var(--rf-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-set-main { position: relative; flex: 1; min-width: 0; overflow-y: auto; padding: 40px clamp(20px, 5vw, 64px); }
.rf-set-x { position: absolute; top: 16px; right: 16px; display: grid; place-items: center; width: 38px; height: 38px; border: 0; border-radius: 10px; background: none; color: var(--rf-muted); }
.rf-set-pane { max-width: 760px; }
.rf-set-pane h2 { margin: 0 0 6px; font-size: 28px; font-weight: 800; letter-spacing: -.02em; }
.rf-set-intro { margin: 0 0 24px; color: var(--rf-muted); font-size: 14px; }
.rf-set-group { margin: 0 0 22px; padding: 18px 20px; border-radius: 14px; background: var(--rf-bg); border: 1px solid var(--rf-border); display: flex; flex-direction: column; gap: 16px; }
.rf-set-group h3 { margin: 0; font-size: 15px; }
.rf-set-group > .rf-set-hint { margin-top: -12px; }
.rf-set-field { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
.rf-set-pane > .rf-set-field { margin-bottom: 26px; }
.rf-set-label { font-size: 13px; font-weight: 600; color: var(--rf-ink-soft); }
.rf-set-hint { margin: -4px 0 2px; font-size: 13px; color: var(--rf-muted); }
.rf-set-warn { color: var(--rf-danger); }
.rf-set-note { min-height: 20px; margin: 8px 0 0; font-size: 13px; color: var(--rf-muted); }
.rf-set-seg { display: inline-flex; flex-wrap: wrap; align-self: flex-start; gap: 4px; padding: 4px; border-radius: 12px; background: var(--rf-hover); }
.rf-set-seg button { border: 0; border-radius: 9px; background: none; padding: 7px 14px; font-size: 14px; color: var(--rf-ink-soft); }
.rf-set-seg button[aria-pressed='true'] { background: var(--rf-bg); color: var(--rf-ink); font-weight: 600; box-shadow: 0 1px 3px rgba(var(--rf-shade),.14); }
.rf-swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.rf-swatches > button { padding: 3px; border: 2px solid transparent; border-radius: 50%; background: none; }
.rf-swatches > button[aria-pressed='true'] { border-color: var(--rf-ink); }
.rf-swatch { display: block; width: 28px; height: 28px; border-radius: 50%; }
.rf-swatch-own { background: conic-gradient(#0e7c52 0 50%, #4cc995 0); }
.rf-swatch-custom { position: relative; display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; background: conic-gradient(#e11d48, #f59e0b, #10b981, #0ea5e9, #8b5cf6, #e11d48); cursor: pointer; }
.rf-swatch-custom input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.rf-swatch-custom:focus-within { box-shadow: 0 0 0 3px var(--rf-focus); }
.rf-set-switch { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 26px; padding: 16px 18px; border-radius: 14px; background: var(--rf-bg); border: 1px solid var(--rf-border); cursor: pointer; }
.rf-set-switch input { margin: 3px 0 0; width: 18px; height: 18px; accent-color: var(--rf-brand); }
.rf-set-switch span { display: flex; flex-direction: column; gap: 2px; }
.rf-set-switch small, .rf-set-cards small { color: var(--rf-muted); font-size: 13px; }
.rf-set-sizes { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
.rf-set-size { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 16px 12px 12px; border-radius: 14px; background: var(--rf-bg); border: 1px solid var(--rf-border); font-size: 13px; font-weight: 600; }
.rf-set-frame { width: var(--rf-frame); height: calc(var(--rf-frame) * .7); margin-top: calc(44px - var(--rf-frame) * .7); border-radius: 4px; border: 2px solid var(--rf-brand); background: var(--rf-brand-light); }
.rf-set-px { display: flex; align-items: center; gap: 6px; font-weight: 400; color: var(--rf-muted); }
.rf-set-px input { width: 84px; font: inherit; color: var(--rf-ink); text-align: right; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--rf-border-strong); background: var(--rf-bg); }
.rf-set-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
.rf-set-cards button { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 16px; border-radius: 14px; border: 1px solid var(--rf-border); background: var(--rf-bg); text-align: left; }
.rf-set-cards button[aria-pressed='true'] { border-color: var(--rf-brand); box-shadow: 0 0 0 1px var(--rf-brand); }
.rf-set-range { width: min(360px, 100%); accent-color: var(--rf-brand); }
@media (max-width: 700px) {
  .rf-set { flex-direction: column; }
  .rf-set-nav { flex-direction: row; width: auto; margin-right: 48px; padding: 10px; gap: 4px; border-right: 0; overflow-x: auto; }
  .rf-set-back { margin: 0; padding: 0 8px; }
  .rf-set-back span, .rf-set-card { display: none; }
  .rf-set-tab { flex: none; }
  .rf-set-main { position: static; padding: 22px 16px; border-top: 1px solid var(--rf-border); }
  .rf-set-x { top: 10px; right: 8px; }
  .rf-set-pane h2 { font-size: 22px; }
}
.rf-select:focus-visible { outline: none; border-color: var(--rf-brand); box-shadow: 0 0 0 3px var(--rf-focus); }

.rf-shared .rf-body { grid-template-columns: minmax(0,1fr); }
.rf-link-rows { list-style: none; margin: 0; padding: 0; }
.rf-link-rows .rf-row { grid-template-columns: minmax(0,1fr) 110px 80px 40px; border-bottom: 1px solid var(--rf-divider); }
.rf-link-rows button.rf-name { border: 0; background: none; padding: 0; text-align: left; }
.rf-link-rows button.rf-name:hover span:last-child { text-decoration: underline; }
.rf-link-rows .rf-btn { padding: 6px; }

@media (max-width: 900px) {
  .rf-body { grid-template-columns: minmax(0,1fr); grid-template-rows: auto minmax(320px,1fr) auto; overflow: auto; }
  .rf-side { flex-direction: row; align-items: center; gap: 6px; overflow-x: auto; }
  .rf-new { margin: 0 4px 0 0; padding: 8px 14px; }
  .rf-nav { padding: 8px 12px; white-space: nowrap; }
  .rf-storage, .rf-where { display: none; }
  .rf-details:has(.rf-none) { display: none; }
  .rf-title { min-width: 0; }
  .rf-title span { display: none; }
  .rf-cols, .rf-row { grid-template-columns: minmax(0,1fr) 80px; }
  .rf-cols > :nth-child(2), .rf-cols > :nth-child(3), .rf-row > :nth-child(2), .rf-row > :nth-child(3) { display: none; }
  .rf-link-rows .rf-row { grid-template-columns: minmax(0,1fr) 80px 40px; }
  .rf-link-rows .rf-row > :nth-child(3) { display: revert; }
}
@media (prefers-reduced-motion: reduce) { .rf-drive *, .rf-toast { transition: none !important; animation: none !important; } }
.rf-drive[data-theme='dark'] {${DARK}}
@media (prefers-color-scheme: dark) { .rf-drive[data-theme='auto'] {${DARK}} }
`;
