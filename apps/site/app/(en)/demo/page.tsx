import { DemoView, demoMeta } from '@/components/views/DemoView';

export const metadata = demoMeta('en');

export default function Demo() {
  return <DemoView locale="en" />;
}
