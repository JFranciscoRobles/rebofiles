import type { Metadata } from 'next';
import { StatusPage } from '@/components/docs/status/StatusPage';

export const metadata: Metadata = {
  title: 'Status',
  description: 'What of ReboFiles is tested and how, what is not yet, its known limits, and what comes next.',
};

export default function Status() {
  return <StatusPage />;
}
