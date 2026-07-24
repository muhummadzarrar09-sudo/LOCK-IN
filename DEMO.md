# Discipline Cohort — Demo Run-of-Show

This is the demo script for tomorrow. The product is at the **MVP**
cut: every screen is real, every flow works end-to-end, the auth
flow is hardened, and the schema is production-shaped (just not
scaled past Supabase free tier yet).

The full post-demo product will be materially better than what
ships tomorrow. The "finished product" promise is in-product at
[/whats-new](/whats-new). Don't oversell.

---

## 30 minutes before the call

1. **Open the Supabase dashboard.** Make sure the project is on
   the free tier, no billing alerts, no rate-limit warnings.
2. **Open the Vercel dashboard.** Confirm the production deploy
   is the latest commit on `arena/019f900c-lock-in`. If it's not,
   trigger a redeploy.
3. **Seed the demo data.** Sign in as admin on the live site,
   open `/admin`, click the **Demo seed** tab, hit **Seed demo
   data**. Wait ~10 seconds. You'll see ~28 fake members,
   6 teams, ~150 check-ins. This is what the client will see
   when they click around.
4. **Open 3 tabs** so navigation feels instant:
   - The landing page (/)
   - The leaderboard (/leaderboard)
   - The dashboard (/dashboard) — signed in

## During the call (15 min)

The story arc is **three clicks**:

### 1. The promise (landing page → 60s)
- Scroll slowly through the hero. "Discipline is not a habit.
  It's a contract." Let that land.
- Click **Enroll** → show the signup form. Note the password
  strength meter (real-time) and the field-level validation.
- Don't actually sign up — close the tab and pivot.

### 2. The proof (signed-in dashboard → 5 min)
- Switch to the dashboard tab.
- The first thing the cohort lead sees: their streak chip,
  the **Next milestone** widget, the **You vs. the cohort**
  card, the **This week** progress ring. Talk through each
  one. They're all real, derived from real check-in data.
- Scroll to the **Today's blocks** list. Click a block to
  check in. Watch the "✓ Saved" feedback, the achievement
  celebration modal, the share card generator.
- Open the **Command Palette** (⌘K or click the search icon).
  Search for a member by name, navigate to them, hit **Get
  card**. Show the share card preview. Talk about how this
  drives social sharing.

### 3. The cohort lead's seat (admin tab → 4 min)
- Navigate to **/admin**.
- The **Daily** tab: the cohort progress card with the health
  score, the day X of 30 strip, the member list with role
  toggles.
- The **Analytics** tab: the retention curve (custom SVG),
  the peak check-in hour heatmap, the top contributors list,
  the **needs a nudge** section. This is where you spend the
  most time.
- Click **CSV** on the retention chart. Show the export.
- Open the **Demo seed** tab. Show the reset + re-seed button.
  "If the cohort is empty on day 1, this populates a realistic
  baseline so you can demo the analytics. We use it for
  screenshots."

### 4. The future (5 min)
- Open **/whats-new** in a new tab. Walk the client through the
  v2.0 release log.
- Scroll to the bottom. The "What's next" card is your
  out: native push, multi-cohort, comments + reactions, follow
  + cheer, light theme, cohort-lead onboarding.
- "This is the MVP. The finished product is on a longer
  runway, but the contract is the same: 30 days. Visible
  streaks. Teams of 3. The grind is the product."

## After the call

- Reset the seed data: **/admin → Demo seed → Reset + re-seed**.
  This wipes demo_* and re-seeds, so the next demo starts clean.
- Or just leave it — Supabase free tier has plenty of room for
  28 fake members + 7 days of check-ins. Won't break anything.

## If something goes wrong

- **Auth is broken.** Don't touch it. The 6-day auth fight in
  `FIX_AUTH_STUCK.md` is real. Defer to the engineer.
- **Real-time toasts are silent.** The Supabase project might
  be rate-limiting channels. Refresh, or wait 30 seconds.
- **A page is blank.** Most likely a missing data row (empty
  cohort). Re-run the demo seed.
- **Anything else.** The admin's **Support** tab has a bug
  report inbox. Use it.
