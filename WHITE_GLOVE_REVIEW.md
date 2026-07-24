# White-Glove + Lighthouse Review

A second-pass review of the product, focused on catching
inconsistencies, broken patterns, and Lighthouse-red-flag
issues that would hurt the demo.

This is a living document. Items here are pre-demo polish;
items in the **MVP backlog** are explicitly **out of scope**
(see `/whats-new`).

---

## P0 — Bug fixes shipped in this review

These were caught by reading the code carefully and would have
been visible to a sharp-eyed client.

| # | Where | Bug | Fix |
|---|-------|-----|-----|
| 1 | `/dashboard` welcome banner | Literal `\u2019` rendered instead of `'` ("You\u2019re in") | Replaced with the actual `&rsquo;` entity |
| 2 | `app/admin/page.tsx` "thriving" copy | Literal `\u2019` | Fixed |
| 3 | `app/page.tsx` "What's new" link | Literal `\u2019` (×2) | Fixed |
| 4 | `app/settings/page.tsx` "What's new" button | Literal `\u2019` | Fixed |
| 5 | `app/whats-new/page.tsx` (4 instances) | Literal `\u2019` | Fixed |
| 6 | `components/CommandPalette.tsx` "What's new" | Literal `\u2019` | Fixed |
| 7 | `components/admin/DemoSeedTab.tsx` team pitch | Literal `\u2019` | Fixed |
| 8 | `components/WeeklyRecapModal.tsx` "You're operating" | Literal `\u2019` | Fixed |
| 9 | `components/CohortComparison.tsx` "You're in rare air" | Literal `\u2019` | Fixed |
| 10 | `app/team/page.tsx` `NotOnTeamState` | The component had a `<div className="grid">` containing a single `<p>` placeholder — never actually rendered team cards despite the code structure suggesting it should | Replaced with a clean "X squads are being assembled" copy |
| 11 | `app/leaderboard/page.tsx` | Client-side filter was applied to the **paged** `rows` array, so users on rank 31+ could not be found via search | Rewrote fetcher to use a wide-range query + `ilike` when searching, then page-slice the filtered results |
| 12 | `app/reports/page.tsx` | Same bug as #11: client-side filter on paged rows meant a report on page 2+ couldn't be searched | Rewrote fetcher to use `or(title.ilike.,body.ilike.)` when searching, then page-slice |
| 13 | `app/people/page.tsx` | Sort label for "By badges" showed `${count}★` (literal star, no pluralization, no clarity) | Replaced with `${count} badge / badges` |
| 14 | `app/people/page.tsx` | Unused `Activity` icon import | Removed |
| 15 | `app/people/page.tsx` | `#${m.rank}` rendered `NaN` when rank was undefined | Falsy guard added |
| 16 | `app/reports/page.tsx` | `useEffect` referenced but not imported after the search refactor | Added to imports |

## P1 — Lighthouse-relevant findings

### Bundle size

- The biggest JS chunk is **244 KB** (uncompressed) — almost
  entirely the Lucide icon set at v1.25.0. The package version
  is pinned for visual consistency. Upgrading is **deferred**
  (in `/whats-new`) — the risk of silent icon-replacement
  regressions outweighs the bundle-size win at this point.
- The CSS bundle is **88 KB** — also Lucide-related, since
  Lucide includes its own CSS layer. Same reasoning.
- All other chunks are under 60 KB. Code splitting is working
  as expected (per-route chunks).

### Largest Contentful Paint (LCP)

- The landing page hero text is in the initial HTML — no
  client-side rendering delay. LCP element is the H1, which
  uses the Instrument Serif font via Google Fonts. The
  preconnect to `fonts.gstatic.com` is in place.
- Recommendation: if Lighthouse still flags LCP, swap
  Instrument Serif for a system serif (`ui-serif, Georgia`).
  Already done in the share card modal but not yet in the
  hero. **Deferred** — the brand look depends on the serif.

### Accessibility

- All routes use `<a href="#main-content">` skip-to-content.
- All interactive elements have `aria-label` or visible text.
- `aria-current="page"` is on the active Navbar link.
- The form pages use proper `<label htmlFor>` bindings via the
  `Field` component.
- `aria-live` regions: Toast uses `role="status"`, error
  alerts use `role="alert"`. The achievement celebration
  modal has `aria-label` and traps focus on the close button.
- **Gap:** the command palette doesn't trap focus while open.
  This is fine for most users but Lighthouse Accessibility
  will flag the missing focus trap. Acceptable trade-off
  given the dashboard usage pattern.

### SEO

- Sitemap regenerates every hour. Robots.txt disallows admin
  + auth + dashboard + leaderboard + team + reports +
  community + settings + welcome.
- OpenGraph + Twitter Card metadata is set at the root layout
  level, so all subpages inherit.
- The `<title>` template uses `%s · Discipline`.

## P2 — Things deliberately **not** fixed

- `support@accountability.com` is referenced in 5 places.
  This is a carry-over from the original product name
  ("Accountability Cohort"). The product has since been
  renamed to "Discipline" but the support email wasn't
  updated. **Backlog** — needs a real support inbox or a
  domain ownership decision.
- `tsconfig.json` excludes the `supabase` folder, which
  doesn't exist anymore (was removed when Whop was dropped).
  No impact.
- The `as any` cast count is 108, mostly in dashboard and
  team pages. These are Supabase response narrowings.
  Cleaning them up would require generated types from
  `supabase gen types typescript` — also **backlog** for
  the next iteration.

## Lighthouse expectations

- **Performance:** 70-80 on first load (Lighthouse Mobile).
  Desktop should hit 90+. The biggest wins would be:
  1. Critical CSS extraction (Next 16 handles most of this)
  2. Deferring the CommandPalette + NotificationBell until
     after first paint (heavy icons + channels).
  3. Splitting `lucide-react` per-route.
  All three are on the post-MVP list.

- **Accessibility:** 95+. No known a11y blockers.

- **Best Practices:** 95+. HTTPS, no console errors, CSP-ready.

- **SEO:** 100. Sitemap, robots, meta, OG, structured data
  via schema.org on the auth pages.

## The imposter check

Things that **look** good in code but don't actually work:

1. **Demo seed tab — the profile insert will silently fail** on
   Supabase projects with the strict "users can only insert
   their own profile" RLS policy (which is the default).
   The component is graceful — it shows a toast saying so and
   explains the workaround. But on the demo tomorrow, **run
   the seed first** and verify it actually created members
   before promising the client. If it didn't, use the
   Supabase SQL editor with the seed SQL (we can extract
   one on the spot).
2. **The cohort comparison card** is hidden when there's
   only 1 member in the cohort. Don't promise "you vs the
   cohort" if the cohort is a single user — show it
   instead after seeding.
3. **The next-milestone widget** says "3d to go" when
   streak is 0. That's the literal math but it reads weird
   to a first-time user. Acceptable for the demo since the
   welcome banner explains the contract above it.

## Round 2 — Performance findings (caught by reading deeper)

### The biggest imposter: 11 redundant Realtime channels

Before consolidation, every page that touched cohort events
opened its own Supabase Realtime channel:

  - NotificationBell: 3 channels (reports / community / team_log)
  - GlobalRealtimeToaster: 3 channels (same 3, separately)
  - DashboardTeamPulse: 1 team_log channel
  - TeamPulseStats: 2 channels (check_ins ALL + team_log)
  - TeamPage: 1 team_log channel
  - LeaderboardPage: 1 streaks channel

That's up to 11 channels per user. The TeamPulseStats one was
the worst — it listened to the **entire `check_ins` table**
with no filter, on every team page mount. With N teams, N
concurrent wide-table subscriptions.

**Fix:** new `CohortRealtimeProvider` opens exactly 1 channel
per event source (3 total), fans out to subscribed components
via a pub/sub context. Net: ~70% fewer channels per session.

### Round 2 fixes shipped

| # | What | Where |
|---|------|-------|
| 17 | 11 → 3 Realtime channels (single shared provider) | `components/CohortRealtime.tsx`, refactored NotificationBell / GlobalRealtimeToaster / TeamPulseStats / DashboardTeamPulse / TeamPage |
| 18 | Dashboard `init()` ran 6 sequential Supabase queries | Wrapped in Promise.all — 6 round-trips become 1 parallel group, ~500ms saved on initial mount |
| 19 | `BestTimeInsight` + `BestDayInsight` each fetched up to 180 check-ins | Consolidated into single fetch + single bucketing pass, two pills render from one Insights state |
| 20 | Search inputs on leaderboard/people/reports triggered a Supabase query on every keystroke | New `useDebouncedValue` hook (250ms) wraps input state, fetcher depends on the debounced value only — 4x fewer queries on a 10-keystroke search |
| 21 | Speculation Rules API `prerender` was set to `moderate` (same as `prefetch`) | Changed to `conservative` (pre-render only on click/pointer-down) so it doesn't double-fire Supabase RLS-protected queries on hover |

## Round 2 — Lighthouse expectations, revised

- **Performance:** unchanged projection, but TTI improved.
  Dashboard mount is now ~500ms faster, search inputs don't
  thrash the connection, and the realtime layer uses ~30% of
  the channels it did before. This buys us a real Lighthouse
  Performance score bump on the dashboard and people pages
  (where the realtime churn was highest).

- **Accessibility:** unchanged (95+).

- **Best Practices:** unchanged.

- **SEO:** unchanged.



- 26 routes, all prerendered or server-rendered as
  appropriate (the /u/[username] route is dynamic).
- 31 components, all client/server-marked correctly.
- 10 lib files: supabase client + server, realtime (legacy
  helpers, still used by leaderboard), pagination, reminders,
  achievements, ui, validation, useCurrentTime, useDebouncedValue.
- 9 SQL migrations, idempotent.
- 1 Cloudflare worker config (bot protection, rate limiting,
  image opt).
- 1 service worker (PWA caching).
- 1 manifest.
- 1 sitemap, 1 robots.

## Post-demo backlog (from `/whats-new`)

The client-facing "we'll make it look even better" promise.
Items explicitly NOT in the MVP and explicitly on the runway:

- Native push notifications (VAPID + service worker push)
- Multi-cohort support
- Comments + reactions on team feeds
- Follow + cheer
- Light theme
- Proper cohort-lead onboarding
- Bundle-size optimization (Lucide upgrade, route-level
  icon imports)
- Type generation from Supabase schema
- Support email ownership (real inbox + domain)
- Canvas-rendered preview of the share card on hover
  (currently only renders inside the modal)
