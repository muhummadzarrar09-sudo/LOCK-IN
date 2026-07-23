import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Discipline — 30-Day Accountability Cohort',
  description: 'Strict daily discipline. Premium accountability community.',
  manifest: '/manifest.json',
  themeColor: '#0D0D0D',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Discipline',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;600;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#0D0D0D] text-[#F2F2F2] antialiased font-sans selection:bg-amber-500/20 selection:text-amber-200">
        <div className="min-h-screen flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
