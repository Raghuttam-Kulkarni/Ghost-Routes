import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ghost-Routes — map the routes nobody talks about',
  description:
    'Log half-forgotten journeys between two places and see them drawn on a living map. Built with Next.js, Leaflet and Supabase.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
