// Shared email templates for Supabase Edge Functions.
// Deno-compatible (no React JSX, just template strings).

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

function wrap(content: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_STYLE}</style></head><body><div class="container"><div class="card">${content}<p class="muted footer">Discipline — Members only. No ads. <a href="https://lockin.app/privacy" style="color: #5A5A5A;">Privacy</a> · <a href="https://lockin.app/terms" style="color: #5A5A5A;">Terms</a></p></div></div></body></html>`;
}

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
    text: `You missed ${missedBlockLabel} today. Open your dashboard: ${dashboardUrl}`,
  };
}
