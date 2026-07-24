/**
 * Email service — Resend
 * --------------------------------------------
 * Free tier: 3,000 emails/month, 100/day.
 * For higher volume, swap to Postmark, SES, or any other provider — just
 * change this file. The rest of the app calls `sendEmail()` and doesn't care.
 *
 * In dev (no RESEND_API_KEY), emails are logged to the console instead of
 * being sent. This keeps the app testable without a real account.
 */

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
};

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Discipline <noreply@lockin.app>';
const REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@accountability.com';
const API_KEY = process.env.RESEND_API_KEY;

export async function sendEmail(payload: EmailPayload): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { to, subject, html, text, replyTo } = payload;

  if (!API_KEY) {
    // Dev / preview mode: log to console, don't actually send.
    if (process.env.NODE_ENV !== 'production') {
      console.info('[email:dev] Would send to', to, '| subject:', subject);
      console.info('[email:dev] Body length:', html.length, 'chars');
      return { ok: true, id: 'dev-' + Date.now() };
    }
    // In production with no key, fail loudly so you don't silently lose emails.
    console.error('[email] RESEND_API_KEY missing in production. Email to', to, 'was NOT sent.');
    return { ok: false, error: 'Email service not configured' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [to],
        reply_to: replyTo || REPLY_TO,
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[email] Resend error:', err);
      return { ok: false, error: err };
    }

    const data = await res.json();
    return { ok: true, id: data.id };
  } catch (err: any) {
    console.error('[email] Fetch failed:', err);
    return { ok: false, error: err?.message || 'Network error' };
  }
}

// ─── Email templates ──────────────────────────────────────────────────────
// Each template returns { subject, html, text }. All templates use inline
// styles only (no external CSS) so they render in any email client.

const BASE_STYLE = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif; background: #0D0D0D; color: #F2F2F2; margin: 0; padding: 40px 20px; }
  .container { max-width: 560px; margin: 0 auto; }
  .card { background: #121212; border: 1px solid #2A2A2A; border-radius: 16px; padding: 32px; }
  .eyebrow { color: #F0B030; font-size: 11px; font-weight: 800; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-family: 'Instrument Serif', Georgia, serif; font-size: 32px; line-height: 1; margin: 0 0 16px; color: #F2F2F2; }
  p { font-size: 15px; line-height: 1.6; color: #A0A0A0; margin: 0 0 16px; }
  .button { display: inline-block; background: #F0B030; color: #000; font-weight: 800; font-size: 14px; padding: 12px 24px; border-radius: 12px; text-decoration: none; }
  .muted { color: #5A5A5A; font-size: 12px; }
  .footer { text-align: center; margin-top: 24px; }
  .divider { border-top: 1px solid #2A2A2A; margin: 24px 0; }
`;

export function welcomeEmail(name: string, loginUrl: string) {
  return {
    subject: "You're in. Welcome to the cohort.",
    html: wrap(`
      <p class="eyebrow">Welcome to the August cohort</p>
      <h1>You did the hard part.</h1>
      <p>Hi ${name},</p>
      <p>You bought the course. You showed up. Now comes the 30 days that actually matter — the part where you ship.</p>
      <p>Your first time block unlocks tomorrow at 06:00 your local time. The dashboard is ready when you are.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${loginUrl}" class="button">Open my dashboard</a>
      </p>
      <p>The contract is simple: show up, check in, ship. Your team sees everything. Your streak compounds.</p>
      <p>— Discipline</p>
    `),
    text: `Welcome to the cohort, ${name}.\n\nYour first time block unlocks tomorrow at 06:00 your local time. Open your dashboard: ${loginUrl}`,
  };
}

export function weeklyDigest(name: string, stats: { streak: number; bestStreak: number; rank: number; totalMembers: number; cohortDay: number }) {
  return {
    subject: `Day ${stats.cohortDay}: your week in the cohort`,
    html: wrap(`
      <p class="eyebrow">Weekly digest</p>
      <h1>Your week, by the numbers.</h1>
      <p>Hi ${name},</p>
      <p>Here's where you stand at Day ${stats.cohortDay} of 30.</p>
      <div class="divider"></div>
      <p><strong style="color: #F0B030;">Current streak:</strong> ${stats.streak} day${stats.streak === 1 ? '' : 's'}</p>
      <p><strong style="color: #F0B030;">Best streak:</strong> ${stats.bestStreak} day${stats.bestStreak === 1 ? '' : 's'}</p>
      <p><strong style="color: #F0B030;">Rank:</strong> #${stats.rank} of ${stats.totalMembers}</p>
      <p><strong style="color: #F0B030;">Days remaining:</strong> ${30 - stats.cohortDay}</p>
      <div class="divider"></div>
      <p>Keep showing up. The team is watching. The streak is real.</p>
    `),
    text: `Day ${stats.cohortDay} of 30. Streak: ${stats.streak}. Best: ${stats.bestStreak}. Rank: #${stats.rank} of ${stats.totalMembers}.`,
  };
}

export function missedBlockNudge(name: string, missedBlockLabel: string, dashboardUrl: string) {
  return {
    subject: `You missed a block. Let's get back to it.`,
    html: wrap(`
      <p class="eyebrow">A friendly nudge</p>
      <h1>One block. That's all.</h1>
      <p>Hi ${name},</p>
      <p>You missed <strong style="color: #F2F2F2;">${missedBlockLabel}</strong> today. Your streak took a hit, but tomorrow is a new day.</p>
      <p>No shame, no lectures. Just a reminder that the contract is the contract. One block at a time.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${dashboardUrl}" class="button">Open my dashboard</a>
      </p>
    `),
    text: `You missed ${missedBlockLabel} today. Open your dashboard to get back on track: ${dashboardUrl}`,
  };
}

export function accountDeletedEmail(name: string) {
  return {
    subject: 'Your account has been deleted',
    html: wrap(`
      <p class="eyebrow">Account deleted</p>
      <h1>It's done.</h1>
      <p>Hi ${name},</p>
      <p>Your account and all associated data have been permanently deleted. This was completed at your request.</p>
      <p>If you change your mind, you're welcome back anytime. Just sign up with the same email.</p>
      <p>Thanks for trying Discipline.</p>
    `),
    text: 'Your account and all associated data have been permanently deleted. If you change your mind, sign up with the same email.',
  };
}

export function bugReportEmail(body: string, fromEmail: string) {
  return {
    subject: `[Bug report] ${fromEmail}`,
    html: wrap(`<p class="eyebrow">Bug report from ${fromEmail}</p><pre style="white-space: pre-wrap; font-family: monospace; color: #F2F2F2; background: #0D0D0D; padding: 16px; border-radius: 8px;">${escapeHtml(body)}</pre>`),
    text: body,
  };
}

export function teamInviteEmail(inviterName: string, teamName: string, acceptUrl: string) {
  return {
    subject: `${inviterName} invited you to join ${teamName}`,
    html: wrap(`
      <p class="eyebrow">Team invite</p>
      <h1>You're invited to ${teamName}.</h1>
      <p>${inviterName} added you to their team for the Discipline cohort. Teams of 3–4 hold each other accountable and ship together.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${acceptUrl}" class="button">Accept invite</a>
      </p>
      <p>Not interested? Just ignore this email — your data won't change.</p>
    `),
    text: `${inviterName} invited you to join ${teamName} on Discipline. Accept here: ${acceptUrl}`,
  };
}

function wrap(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body><div class="container"><div class="card">${content}<p class="muted footer">Discipline — Members only. No ads. <a href="https://lockin.app/privacy" style="color: #5A5A5A;">Privacy</a> · <a href="https://lockin.app/terms" style="color: #5A5A5A;">Terms</a></p></div></div></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
}
