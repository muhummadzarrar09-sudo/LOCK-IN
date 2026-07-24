import Link from 'next/link';
import { ArrowLeft, ScrollText } from 'lucide-react';
import type { Metadata } from 'next';

// Force static generation — content-stable, served from edge forever.
export const dynamic = 'force-static';
export const revalidate = false;

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms under which you can use Discipline.',
};

export default function TermsPage() {
  return (
    <main id="main-content" className="min-h-screen bg-[#0D0D0D] text-[#F2F2F2]">
      <div className="max-w-2xl mx-auto px-5 md:px-6 py-12 md:py-20">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-amber-300 mb-8 transition-colors">
          <ArrowLeft className="w-3 h-3" /> Back home
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-700/30 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tighter">Terms of Service</h1>
            <p className="text-[11px] text-neutral-500">Last updated: July 2026</p>
          </div>
        </div>

        <div className="space-y-6 text-sm text-neutral-300 leading-relaxed">
          <Section title="The contract">
            <p>Discipline is a 30-day execution cohort. By joining, you agree to the following:</p>
            <ul>
              <li><strong>Show up.</strong> Check in to your time blocks. Missed blocks visibly break your streak.</li>
              <li><strong>Ship.</strong> The cohort exists to turn knowledge into output.</li>
              <li><strong>Be accountable.</strong> Your team sees your check-ins. Be honest with them.</li>
            </ul>
          </Section>

          <Section title="Membership">
            <p>Membership is for the cohort duration. The cohort does not auto-renew. You can re-enroll in future cohorts at your discretion.</p>
          </Section>

          <Section title="Refunds">
            <p>All cohort sales are final. No refunds, no extensions, no transfers. The contract starts when you enroll.</p>
          </Section>

          <Section title="Conduct">
            <p>Be a good teammate. No harassment, no spam, no sabotaging others&apos; progress. We reserve the right to remove members who violate this.</p>
          </Section>

          <Section title="Content ownership">
            <p>Your check-ins, team feed posts, and profile data are yours. By using Discipline, you grant us a limited license to display this content within the cohort for accountability purposes.</p>
          </Section>

          <Section title="Disclaimer">
            <p>Discipline is an accountability tool, not a substitute for medical, mental health, or financial advice. Use it as a tool, not a crutch.</p>
          </Section>

          <Section title="Liability">
            <p>We&apos;re building this for you, but we can&apos;t guarantee outcomes. Your results depend on your effort.</p>
          </Section>

          <Section title="Changes">
            <p>We may update these terms. We&apos;ll notify active members via the Community page.</p>
          </Section>

          <Section title="Contact">
            <p>Questions? Email <a href="mailto:support@accountability.com" className="text-amber-300 hover:text-amber-200 underline">support@accountability.com</a>.</p>
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
