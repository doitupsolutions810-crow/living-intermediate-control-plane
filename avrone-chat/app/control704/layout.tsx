import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: "Control704 · Avrone Due'Krey",
  description: 'Control704 IT Technician access layer',
  robots: { index: false, follow: false }
};

export default function Control704Layout({ children }: { children: ReactNode }) {
  return children;
}
