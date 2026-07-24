import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import type { Metadata } from 'next';

// Force static generation — this page is content-stable, served from edge forever.
export const dynamic = 'force-static';
export const revalidate = false;

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Discipline collects, uses, and protects your data.',
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
      <div className="max-w-2xl mx-auto px-5 md:px-6 py-12 md:py-20">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-8 transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back home
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-700/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tighter">Privacy Policy</h1>
            <p className="text-[11px] text-neutral-500">Last updated: July 2026</p>
          </div>
        </div>

        <div className="prose prose-invert max-w-none space-y-6 text-sm text-neutral-300 leading-relaxed">
          <Section title="What we collect">
            <p>To run your cohort, we collect:</p>
            <ul>
              <li><strong>Account info</strong> — your email, username, and timezone.</li>
              <li><strong>Cohort data</strong> — time blocks, check-ins, streaks, team membership, team feed posts.</li>
              <li><strong>Notifications</strong> — your reminder preferences, stored in your browser.</li>
              <li><strong>Authentication data</strong> — managed by our secure authentication provider. We never see your password.</li>
            </ul>
          </Section>

          <Section title="What we do NOT collect">
            <ul>
              <li>We do not sell your data. Ever.</li>
              <li>We do not run third-party advertising trackers.</li>
              <li>We do not collect your location beyond the timezone you set.</li>
            </ul>
          </Section>

          <Section title="How we use your data">
            <p>Your data is used to:</p>
            <ul>
              <li>Render your cohort dashboard, team feed, and leaderboard.</li>
              <li>Send you the notifications you opted into.</li>
              <li>Calculate your streak, completion rate, and team progress.</li>
            </ul>
          </Section>

          <Section title="Where your data lives">
            <p>Your data is stored in a secure managed database and authentication system. Reports and community posts cached for offline reading are stored in your browser&apos;s local storage and the PWA cache.</p>
          </Section>

          <Section title="Your rights">
            <p>You can:</p>
            <ul>
              <li>View, edit, or delete your profile data from the Settings page.</li>
              <li>Export your data by contacting support.</li>
              <li>Delete your account by emailing <a href="mailto:support@lockin.app" className="text-amber-300 hover:text-amber-200 underline">support@lockin.app</a>.</li>
            </ul>
          </Section>

          <Section title="Cookies">
            <p>We use only functional cookies required for authentication (managed by our secure authentication provider). No analytics cookies. No advertising cookies.</p>
          </Section>

          <Section title="Contact">
            <p>Questions? Email <a href="mailto:support@lockin.app" className="text-amber-300 hover:text-amber-200 underline">support@lockin.app</a>.</p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-extrabold text-white mb-3 tracking-tight">{title}</h2>
      <div className="space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_li]:text-neutral-300 [&_strong]:text-white">
        {children}
      </div>
    </section>
  );
}
