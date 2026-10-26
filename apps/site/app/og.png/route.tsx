import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

/** The card a link to the site shows, made once when the site is built. */
export function GET() {
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', background: '#fbfaf7', color: '#2f2e2b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
        <svg width="84" height="84" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#E3F4EA" />
          <path
            d="M9 11.5a1.5 1.5 0 0 1 1.5-1.5h3.6l1.8 2h5.6a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 9 20Z"
            fill="none"
            stroke="#0E7C52"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 48, fontWeight: 800, letterSpacing: -1.5 }}>ReboFiles</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>
        <span style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.04, letterSpacing: -3 }}>The file drive you build into your app.</span>
        <span style={{ fontSize: 32, color: '#6b6963', lineHeight: 1.4 }}>Folders, uploads, previews, versions, the trash and sharing — on your own storage. Open source, MIT.</span>
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        {['React', 'Headless hooks', 'S3 · disk', 'SQLite · Postgres', 'MCP'].map((tag) => (
          <span key={tag} style={{ padding: '10px 20px', borderRadius: 999, background: '#e3f4ea', color: '#0e7c52', fontSize: 26, fontWeight: 600 }}>
            {tag}
          </span>
        ))}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
