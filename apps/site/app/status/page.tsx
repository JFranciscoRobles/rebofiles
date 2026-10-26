import type { Metadata } from 'next';
import { STATUS } from '@/lib/site';

export const metadata: Metadata = { title: 'Status', robots: { index: false }, alternates: { canonical: STATUS } };

/** The page that was here is in the documentation now: gone to, for an address that was given before. */
export default function Status() {
  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${STATUS}`} />
      <p className="p-8">
        It is in the documentation now: <a href={STATUS}>Status and roadmap</a>.
      </p>
    </>
  );
}
