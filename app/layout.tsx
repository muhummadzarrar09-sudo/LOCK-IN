import './globals.css';
import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/Toast';
import { InstallPrompt } from '@/components/InstallPrompt';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { CookieConsent } from '@/components/CookieConsent';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://lockin.app';
const OG_IMAGE = `${BASE_URL}/icon-512.png`;

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Discipline — 30-Day Execution Cohort',
    template: '%s · Discipline',
  },
  description: 'A 30-day execution cohort for serious builders. Time-blocked days. Visible streaks. Teams of 3. The contract.',
  applicationName: 'Discipline',
  keywords: ['discipline', 'accountability', 'cohort', 'productivity', 'habits', 'team', 'startup', 'execution', '30 day challenge'],
  authors: [{ name: 'Discipline' }],
  creator: 'Discipline',
  publisher: 'Discipline',
  formatDetection: { telephone: false, address: false, email: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Discipline',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '256x256' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: BASE_URL,
    siteName: 'Discipline',
    title: 'Discipline — 30-Day Execution Cohort',
    description: 'A 30-day execution cohort for serious builders. Time-blocked days. Visible streaks. Teams of 3.',
    images: [
      { url: OG_IMAGE, width: 512, height: 512, alt: 'Discipline — 30-Day Execution Cohort' },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discipline — 30-Day Execution Cohort',
    description: 'A 30-day execution cohort for serious builders. Visible streaks. Teams of 3. The contract.',
    images: [OG_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0D0D0D' },
    { media: '(prefers-color-scheme: light)', color: '#0D0D0D' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        {/* DNS prefetch + preconnect — cuts ~100-300ms off first paint */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Preconnect to Supabase for faster auth on first interaction */}
        <link rel="dns-prefetch" href="https://supabase.co" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;600;800;900&display=swap" rel="stylesheet" />

        {/* Speculation Rules API — pre-render next navigation on hover (Chrome 109+).
            Makes dashboard→leaderboard→team→reports feel instant. */}
        <script
          type="speculationrules"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              prefetch: [
                {
                  source: 'document',
                  where: { and: [{ href_matches: '/*' }, { not: { href_matches: ['/api/*', '/auth/*', '/admin/*', '/settings/*', '/welcome', '/_next/*'] } }] },
                  eagerness: 'moderate',
                },
              ],
              prerender: [
                {
                  source: 'document',
                  where: { and: [{ href_matches: '/*' }, { not: { href_matches: ['/api/*', '/auth/*', '/admin/*', '/settings/*', '/welcome', '/_next/*'] } }] },
                  eagerness: 'moderate',
                },
              ],
            }),
          }}
        />
      </head>
      <body className="bg-[#0D0D0D] text-[#F2F2F2] antialiased font-sans selection:bg-amber-500/20 selection:text-amber-200">
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <ToastProvider>
          <div className="min-h-screen flex flex-col">
            {children}
            <InstallPrompt />
            <CookieConsent />
          </div>
        </ToastProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
