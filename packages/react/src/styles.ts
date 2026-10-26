// How the drive looks, as one stylesheet scoped to `.rf-drive`. Its colours,
// radii and fonts are custom properties: an application changes them on the
// element, or on a class of its own, and leaves the rest. The values are the
// suite's (Rebodocs' neutrals and pastels) with ReboFiles' emerald.

export const CSS = `
.rf-drive {
  --rf-brand: #0e7c52; --rf-brand-hover: #095c3c; --rf-brand-light: #e3f4ea; --rf-focus: #8fd3ae;
  --rf-docs: #0b57d0; --rf-docs-hover: #08398a;
  --rf-ink: #2f2e2b; --rf-ink-soft: #4a4843; --rf-muted: #6b6964; --rf-faint: #9b9890;
  --rf-surface: #f7f6f3; --rf-hover: #f1f0ec; --rf-border: #eae8e3; --rf-border-strong: #dddad3; --rf-divider: #f0eee9;
  --rf-danger: #b13a2a; --rf-danger-light: #fbe8ef; --rf-bg: #fff;
  --rf-font: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --rf-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  --rf-radius: 14px;
  --rf-shadow-menu: 0 16px 36px rgba(47,46,43,.14);
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
.rf-search:focus-within { background: var(--rf-bg); box-shadow: 0 0 0 1px var(--rf-border-strong), 0 2px 8px rgba(47,46,43,.08); }
.rf-search input { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; color: var(--rf-ink); outline: none; }
.rf-search button { border: 0; background: none; display: grid; place-items: center; padding: 4px; border-radius: 999px; color: var(--rf-muted); }

.rf-body { flex: 1; min-height: 0; display: grid; grid-template-columns: 210px minmax(0,1fr) 290px; gap: 12px; padding: 12px; background: var(--rf-surface); }
.rf-side { display: flex; flex-direction: column; gap: 4px; min-height: 0; }
.rf-new { display: flex; align-items: center; gap: 10px; padding: 12px 18px; margin-bottom: 8px; border: 0; border-radius: 14px; background: var(--rf-bg); font-weight: 600;
  box-shadow: 0 1px 3px rgba(47,46,43,.12), 0 4px 12px rgba(47,46,43,.08); transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s; align-self: flex-start; }
.rf-new:hover { transform: translateY(-2px); box-shadow: 0 2px 6px rgba(47,46,43,.12), 0 10px 22px rgba(47,46,43,.1); }
.rf-new svg { color: var(--rf-brand); }
.rf-menu { position: absolute; z-index: 5; margin-top: 50px; min-width: 190px; padding: 6px; border-radius: 12px; background: var(--rf-bg); box-shadow: var(--rf-shadow-menu); border: 1px solid var(--rf-border); }
.rf-menu button { display: flex; width: 100%; align-items: center; gap: 10px; padding: 8px 10px; border: 0; background: none; border-radius: 8px; text-align: left; }
.rf-menu button:hover, .rf-menu button:focus-visible { background: var(--rf-hover); }
.rf-nav { display: flex; align-items: center; gap: 12px; padding: 8px 14px; border: 0; border-radius: 999px; background: none; text-align: left; color: var(--rf-ink-soft); }
.rf-nav:hover { background: var(--rf-hover); }
.rf-nav[aria-current='true'] { background: var(--rf-brand-light); color: var(--rf-brand); font-weight: 600; }
.rf-nav.rf-drop { box-shadow: inset 0 0 0 2px var(--rf-brand); }
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
.rf-btn.rf-primary { background: var(--rf-brand); border-color: var(--rf-brand); color: #fff; font-weight: 600; }
.rf-btn.rf-primary:hover { background: var(--rf-brand-hover); }
.rf-btn.rf-docs { background: var(--rf-docs); border-color: var(--rf-docs); color: #fff; font-weight: 600; }
.rf-btn.rf-docs:hover { background: var(--rf-docs-hover); }
.rf-btn.rf-text { border-color: transparent; background: none; }
.rf-btn.rf-danger { color: var(--rf-danger); }
.rf-btn.rf-danger:hover { background: var(--rf-danger-light); }

.rf-items { flex: 1; min-height: 0; overflow: auto; outline: none; }
.rf-items:focus-visible { box-shadow: inset 0 0 0 3px var(--rf-focus); }
.rf-cols, .rf-row { display: grid; grid-template-columns: minmax(0,1fr) 90px 110px 80px; gap: 12px; align-items: center; padding: 9px 16px; }
.rf-cols { position: sticky; top: 0; z-index: 1; background: var(--rf-bg); font-size: 12px; font-weight: 500; color: var(--rf-muted); border-bottom: 1px solid var(--rf-divider); }
.rf-row { border-bottom: 1px solid var(--rf-divider); cursor: default; user-select: none; color: var(--rf-ink-soft); font-size: 13px; }
.rf-row:hover { background: var(--rf-surface); }
.rf-row[aria-selected='true'] { background: var(--rf-brand-light); }
.rf-row.rf-active { box-shadow: inset 3px 0 0 var(--rf-brand); }
.rf-row.rf-drop, .rf-card.rf-drop { box-shadow: inset 0 0 0 2px var(--rf-brand); }
.rf-name { display: flex; align-items: center; gap: 12px; min-width: 0; color: var(--rf-ink); font-size: 14px; font-weight: 500; }
.rf-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-tile { flex: none; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font-size: 8.5px; font-weight: 700; letter-spacing: .02em; }
.rf-k-folder { background: #fbf3db; color: #c58a12; }
.rf-k-docx { background: #e8f0fd; color: #0b57d0; }
.rf-k-pdf { background: #fbe8ef; color: #a23a5e; }
.rf-k-sheet { background: #e7f3ea; color: #2e6b3c; }
.rf-k-image { background: #f0ebf8; color: #6a4a9c; }
.rf-k-text, .rf-k-other { background: #fcebdd; color: #a4521c; }
.rf-k-folder svg { fill: currentColor; }

.rf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; padding: 4px 12px 12px; }
.rf-card { border-radius: 14px; background: var(--rf-surface); border: 1px solid transparent; padding: 8px; cursor: default; user-select: none; transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s; }
.rf-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(47,46,43,.1); }
.rf-card[aria-selected='true'] { background: var(--rf-brand-light); border-color: var(--rf-focus); }
.rf-thumb { height: 96px; border-radius: 10px; display: grid; place-items: center; margin-bottom: 8px; overflow: hidden; }
.rf-thumb img { width: 100%; height: 100%; object-fit: cover; }
.rf-card .rf-name { font-size: 13px; gap: 8px; padding: 0 4px 2px; }
.rf-card .rf-tile { width: 22px; height: 22px; border-radius: 6px; font-size: 7px; }

.rf-empty { display: grid; place-items: center; text-align: center; padding: 48px 24px; color: var(--rf-muted); }
.rf-empty svg { color: var(--rf-faint); margin-bottom: 10px; }
.rf-dropzone { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; border-radius: var(--rf-radius); background: rgba(227,244,234,.92); border: 2px dashed var(--rf-brand); color: var(--rf-brand); font-weight: 600; font-size: 16px; pointer-events: none; }

.rf-details { overflow: auto; }
.rf-details-in { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.rf-details h2 { margin: 0; font-size: 16px; font-weight: 700; overflow-wrap: anywhere; }
.rf-none { padding: 24px 16px; color: var(--rf-muted); }
.rf-preview { height: 150px; border-radius: 12px; background: var(--rf-surface); display: grid; place-items: center; overflow: hidden; border: 1px solid var(--rf-border); }
.rf-preview img { max-width: 100%; max-height: 100%; object-fit: contain; }
.rf-preview iframe { width: 100%; height: 100%; border: 0; background: #fff; }
.rf-preview pre { align-self: stretch; justify-self: stretch; margin: 0; padding: 10px 12px; font: 11px/1.5 var(--rf-mono); color: var(--rf-ink-soft); white-space: pre-wrap; overflow: hidden; background: #fff; }
.rf-page { align-self: stretch; width: 74%; justify-self: center; margin-top: 14px; padding: 12px 14px; background: #fff; border-radius: 4px 4px 0 0; box-shadow: 0 2px 10px rgba(47,46,43,.12); overflow: hidden; font-size: 6.5px; line-height: 1.5; color: var(--rf-ink-soft); }
.rf-page strong { display: block; font-size: 9px; color: var(--rf-ink); margin-bottom: 5px; }
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

.rf-toast { position: absolute; left: 50%; bottom: 44px; transform: translateX(-50%); z-index: 6; background: #2f2e2b; color: #fff; font-size: 14px; border-radius: 12px; padding: 12px 18px; box-shadow: var(--rf-shadow-menu); max-width: calc(100% - 32px); animation: rf-pop .5s cubic-bezier(.2,.8,.2,1); }
@keyframes rf-pop { from { opacity: 0; transform: translate(-50%, 8px); } }

.rf-dialog { border: 0; padding: 0; border-radius: 16px; box-shadow: var(--rf-shadow-menu); width: min(420px, calc(100vw - 32px)); color: var(--rf-ink); font: 14px/1.45 var(--rf-font); }
.rf-dialog::backdrop { background: rgba(47,46,43,.28); }
.rf-dialog form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.rf-dialog h2 { margin: 0; font-size: 18px; font-weight: 700; }
.rf-dialog input[type='text'] { font: inherit; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--rf-border-strong); outline: none; }
.rf-dialog input[type='text']:focus { border-color: var(--rf-brand); box-shadow: 0 0 0 3px var(--rf-focus); }
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
.rf-select { font: inherit; font-size: 13px; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--rf-border-strong); background: var(--rf-bg); color: inherit; }
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
`;
