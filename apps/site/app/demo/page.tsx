import type { Metadata } from 'next';
import { DemoApp } from '@/components/demos/DemoApp';
import { DEMOS } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Demo',
  description: 'The drive in your browser, two ways: the interface that comes with it, and one of your own built on the headless hooks. Nothing leaves the page.',
  alternates: { canonical: DEMOS },
};

export default function Demo() {
  return (
    <main>
      <DemoApp />
    </main>
  );
}
