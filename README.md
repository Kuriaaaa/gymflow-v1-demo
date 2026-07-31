# GymFlow V1 Public Demo

This is the hosted demonstration edition of GymFlow V1. It preserves the
latest owner, receptionist, trainer, and member workflows while using fictional
seed data and browser-local storage so no real gym or payment information is
published.

## Included workflows

- Owner dashboard and role-aware workspace navigation
- Receptionist member registration
- One active membership per member
- Payment approval linked to the selected membership
- Attendance check-in
- Trainer schedules and workout assignments
- Owner expenses and operational summaries

## Local development

Requires Node.js 22.13 or newer and pnpm.

```bash
pnpm install
pnpm dev
```

Run the production build and rendered-output test with:

```bash
pnpm test
```

The original Python/SQLite GymFlow V1 remains the authoritative local
development application. This hosted edition is intentionally a safe,
device-local public demo.
