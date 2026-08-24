import { allSeries } from '@/lib/data';
import RandomClient from './RandomClient';

export const metadata = { title: 'فاجئني' };

export default function RandomPage() {
  return <RandomClient slugs={allSeries.map((s) => s.slug)} />;
}
