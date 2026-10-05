# GymFlow V1 Public Demo

Live demo: <https://kuriaaaa.github.io/gymflow-v1-demo/>

This is the hosted demonstration edition of GymFlow V1. It preserves the
latest owner, receptionist, trainer, and member workflows while using fictional
seed data and browser-local storage so no real gym or payment information is
published.

## Included workflows

- Owner dashboard and role-aware workspace navigation with role-scoped metrics
- Receptionist member registration
- One active or queued membership per member, with real expiry dates,
  renewals, cancellations and an "Expiring this week" list
- Members request payments; the owner or receptionist confirms or rejects them
- Payments linked to a specific membership period
- Attendance check-in (requires an active membership)
- Trainer schedules and workout assignments
- Owner expenses and operational summaries

## Local development

Requires Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Run the production build, rule unit tests and rendered-output tests with:

```bash
pnpm test
```

`pnpm build` (alias `pnpm build:pages`) writes the static GitHub Pages edition
to `dist-pages/`.

Pull requests and branch pushes run CI (build, tests, type check, lint).
Every push to `main` is deployed automatically to GitHub Pages.

This hosted edition is intentionally a safe, device-local public demo. Want to
see GymFlow with your own gym's data?
[Book a demo](mailto:johnkuria6996@gmail.com?subject=GymFlow%20demo%20request).
