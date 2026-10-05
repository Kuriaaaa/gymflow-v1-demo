// Pure business rules for the public GymFlow demo.
// Kept free of React and browser APIs so they can be unit-tested with
// `node --experimental-strip-types --test`.
import type { Assignment } from "./demo-policy";

export type Role = "owner" | "receptionist" | "trainer" | "member";
export type Person = { id: number; name: string; email: string; role: Role; status: "active" };
export type Package = { name: string; days: number; price: number };
/** `startsOn` and `endsOn` are inclusive calendar days (YYYY-MM-DD). */
export type Membership = { id: number; memberId: number; packageName: string; startsOn: string; endsOn: string; status: "active" | "cancelled" };
export type MembershipStatus = "active" | "upcoming" | "expired" | "cancelled";
export type Visit = { id: number; memberId: number; checkedIn: string; checkedOut?: string };
export type Session = { id: number; memberId: number; trainerId: number; title: string; startsAt: string };
export type Workout = { id: number; memberId: number; trainerId: number; title: string; instructions: string };
export type PaymentMethod = "M-Pesa sandbox" | "Card sandbox" | "Cash demo";
export type PaymentStatus = "pending" | "confirmed" | "rejected";
/** `membershipId` is null for a request that will create a new/renewal membership once confirmed. */
export type Payment = {
  id: number;
  memberId: number;
  membershipId: number | null;
  packageName: string;
  amount: number;
  reference: string;
  method: PaymentMethod;
  status: PaymentStatus;
  createdAt: string;
};
export type Expense = { id: number; category: string; amount: number; date: string };

export type DemoState = {
  people: Person[];
  memberships: Membership[];
  visits: Visit[];
  sessions: Session[];
  workouts: Workout[];
  assignments: Assignment[];
  payments: Payment[];
  expenses: Expense[];
  packages: Package[];
};

export type RuleResult = { ok: true; state: DemoState; message: string } | { ok: false; message: string };

export const ROLES: Role[] = ["owner", "receptionist", "trainer", "member"];
export const PERSONA_IDS: Record<Role, number> = { owner: 1, receptionist: 2, trainer: 3, member: 4 };
export const PAYMENT_METHODS: PaymentMethod[] = ["M-Pesa sandbox", "Card sandbox", "Cash demo"];
const STAFF_ROLES: Role[] = ["owner", "receptionist"];

const fail = (message: string): RuleResult => ({ ok: false, message });

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** Local calendar day for a Date, as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Adds whole days to a YYYY-MM-DD string without timezone drift. */
export function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** ISO timestamp for a local day and HH:MM time. */
function localIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00`).toISOString();
}

// ---------------------------------------------------------------------------
// Ids and lookups
// ---------------------------------------------------------------------------

export function nextId(items: { id: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
}

export function nameOf(state: DemoState, id: number): string {
  return state.people.find((person) => person.id === id)?.name ?? "Unknown";
}

function findPackage(state: DemoState, packageName: string) {
  return state.packages.find((item) => item.name === packageName);
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export function membershipStatus(membership: Membership, today: string): MembershipStatus {
  if (membership.status === "cancelled") return "cancelled";
  if (today < membership.startsOn) return "upcoming";
  if (today > membership.endsOn) return "expired";
  return "active";
}

/** Memberships that are running now or queued to start (not expired, not cancelled). */
export function openMemberships(state: DemoState, memberId: number, today: string): Membership[] {
  return state.memberships
    .filter((item) => item.memberId === memberId)
    .filter((item) => {
      const status = membershipStatus(item, today);
      return status === "active" || status === "upcoming";
    })
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

export function activeMembership(state: DemoState, memberId: number, today: string): Membership | undefined {
  return state.memberships.find((item) => item.memberId === memberId && membershipStatus(item, today) === "active");
}

function nextStartFor(state: DemoState, memberId: number, today: string): string {
  const open = openMemberships(state, memberId, today);
  if (open.length === 0) return today;
  const latestEnd = open.reduce((latest, item) => (item.endsOn > latest ? item.endsOn : latest), open[0].endsOn);
  return addDays(latestEnd, 1);
}

function buildMembership(state: DemoState, memberId: number, pkg: Package, startsOn: string): Membership {
  return { id: nextId(state.memberships), memberId, packageName: pkg.name, startsOn, endsOn: addDays(startsOn, pkg.days - 1), status: "active" };
}

export function activateMembership(state: DemoState, memberId: number, packageName: string, today: string): RuleResult {
  const pkg = findPackage(state, packageName);
  if (!pkg) return fail("Choose a valid package.");
  if (!state.people.some((person) => person.id === memberId && person.role === "member")) return fail("Choose a valid member.");
  if (openMemberships(state, memberId, today).length > 0) {
    return fail("Blocked: this member already has an active or queued membership. Use Renew in the memberships table instead.");
  }
  const membership = buildMembership(state, memberId, pkg, today);
  return {
    ok: true,
    state: { ...state, memberships: [...state.memberships, membership] },
    message: `${pkg.name} membership activated for ${nameOf(state, memberId)} until ${membership.endsOn}. Record a payment to settle it.`,
  };
}

export function renewMembership(state: DemoState, membershipId: number, today: string): RuleResult {
  const source = state.memberships.find((item) => item.id === membershipId);
  if (!source) return fail("Membership not found.");
  if (source.status === "cancelled") return fail("Cancelled memberships cannot be renewed. Activate a new plan instead.");
  const pkg = findPackage(state, source.packageName);
  if (!pkg) return fail("This package is no longer offered.");
  const open = openMemberships(state, source.memberId, today);
  if (open.some((item) => membershipStatus(item, today) === "upcoming")) {
    return fail("Blocked: a renewal is already queued for this member.");
  }
  const startsOn = nextStartFor(state, source.memberId, today);
  const membership = buildMembership(state, source.memberId, pkg, startsOn);
  const when = startsOn === today ? "starting today" : `starting ${startsOn}`;
  return {
    ok: true,
    state: { ...state, memberships: [...state.memberships, membership] },
    message: `${pkg.name} renewal for ${nameOf(state, source.memberId)} ${when}, ending ${membership.endsOn}. Record a payment to settle it.`,
  };
}

export function cancelMembership(state: DemoState, membershipId: number, today: string): RuleResult {
  const membership = state.memberships.find((item) => item.id === membershipId);
  if (!membership) return fail("Membership not found.");
  const status = membershipStatus(membership, today);
  if (status === "cancelled") return fail("This membership is already cancelled.");
  if (status === "expired") return fail("Expired memberships do not need cancelling.");
  return {
    ok: true,
    state: {
      ...state,
      memberships: state.memberships.map((item) => (item.id === membershipId ? { ...item, status: "cancelled" as const } : item)),
      payments: state.payments.map((item) => (item.membershipId === membershipId && item.status === "pending" ? { ...item, status: "rejected" as const } : item)),
    },
    message: `${membership.packageName} membership for ${nameOf(state, membership.memberId)} cancelled.`,
  };
}

/** Active memberships ending within `days` days that have no renewal queued. */
export function expiringWithin(state: DemoState, today: string, days = 7): Membership[] {
  const limit = addDays(today, days);
  return state.memberships
    .filter((item) => membershipStatus(item, today) === "active" && item.endsOn <= limit)
    .filter((item) => !openMemberships(state, item.memberId, today).some((other) => membershipStatus(other, today) === "upcoming"))
    .sort((a, b) => a.endsOn.localeCompare(b.endsOn));
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

type PaymentTarget = { ok: true; membershipId: number | null } | { ok: false; message: string };

/**
 * Works out which membership a payment settles. A payment always links to a
 * membership id, so paying for a renewal never collides with the payment for
 * the previous period of the same package.
 */
function planPaymentTarget(state: DemoState, memberId: number, packageName: string, today: string, ignorePaymentId?: number): PaymentTarget {
  const payments = state.payments.filter((item) => item.id !== ignorePaymentId && item.memberId === memberId);
  const isPaid = (membershipId: number) => payments.some((item) => item.membershipId === membershipId && item.status === "confirmed");
  const isPending = (membershipId: number) => payments.some((item) => item.membershipId === membershipId && item.status === "pending");

  const open = openMemberships(state, memberId, today);
  const unpaid = open.find((item) => !isPaid(item.id));
  if (unpaid) {
    if (isPending(unpaid.id)) return { ok: false, message: "Blocked: a payment for this membership is already awaiting confirmation." };
    if (unpaid.packageName !== packageName) {
      return { ok: false, message: `Blocked: the selected package differs from the ${unpaid.packageName} membership awaiting payment.` };
    }
    return { ok: true, membershipId: unpaid.id };
  }
  if (open.some((item) => membershipStatus(item, today) === "upcoming")) {
    return { ok: false, message: "Blocked: the next membership period is already queued and paid." };
  }
  if (payments.some((item) => item.membershipId === null && item.status === "pending")) {
    return { ok: false, message: "Blocked: a payment request is already awaiting confirmation." };
  }
  return { ok: true, membershipId: null };
}

function reference(id: number) {
  return `GF-DEMO-${String(id).padStart(3, "0")}`;
}

/** Applies a confirmed payment: links it to an existing membership or creates the new/renewal period. */
function settle(state: DemoState, payment: Payment, today: string): RuleResult {
  const target = planPaymentTarget(state, payment.memberId, payment.packageName, today, payment.id);
  if (!target.ok) return fail(target.message);
  const pkg = findPackage(state, payment.packageName);
  if (!pkg) return fail("This package is no longer offered.");

  let next = state;
  let membershipId = payment.membershipId ?? target.membershipId;
  if (payment.membershipId !== null && target.membershipId !== payment.membershipId) {
    return fail("Blocked: the linked membership is no longer awaiting payment.");
  }
  let note = "";
  if (membershipId === null) {
    const startsOn = nextStartFor(state, payment.memberId, today);
    const membership = buildMembership(state, payment.memberId, pkg, startsOn);
    membershipId = membership.id;
    next = { ...next, memberships: [...next.memberships, membership] };
    note = startsOn === today ? ` ${pkg.name} membership active until ${membership.endsOn}.` : ` Renewal runs ${startsOn} to ${membership.endsOn}.`;
  }
  const confirmed: Payment = { ...payment, membershipId, status: "confirmed" };
  const exists = next.payments.some((item) => item.id === payment.id);
  return {
    ok: true,
    state: { ...next, payments: exists ? next.payments.map((item) => (item.id === payment.id ? confirmed : item)) : [...next.payments, confirmed] },
    message: `${payment.method} payment ${payment.reference} confirmed for ${nameOf(state, payment.memberId)}.${note}`,
  };
}

function newPayment(state: DemoState, memberId: number, membershipId: number | null, pkg: Package, method: PaymentMethod, status: PaymentStatus, nowIso: string): Payment {
  const id = nextId(state.payments);
  return { id, memberId, membershipId, packageName: pkg.name, amount: pkg.price, reference: reference(id), method, status, createdAt: nowIso };
}

/** Member self-service: creates a pending request that staff must confirm. */
export function requestPayment(state: DemoState, memberId: number, packageName: string, method: PaymentMethod, today: string, nowIso: string): RuleResult {
  const pkg = findPackage(state, packageName);
  if (!pkg) return fail("Choose a valid package.");
  if (!PAYMENT_METHODS.includes(method)) return fail("Choose a valid payment method.");
  const target = planPaymentTarget(state, memberId, packageName, today);
  if (!target.ok) return fail(target.message);
  const payment = newPayment(state, memberId, target.membershipId, pkg, method, "pending", nowIso);
  return {
    ok: true,
    state: { ...state, payments: [...state.payments, payment] },
    message: `Payment request ${payment.reference} sent. The front desk will confirm it before your membership changes.`,
  };
}

/** Front desk records a payment received in person; it is confirmed immediately. */
export function recordPayment(state: DemoState, actorRole: Role, memberId: number, packageName: string, method: PaymentMethod, today: string, nowIso: string): RuleResult {
  if (!STAFF_ROLES.includes(actorRole)) return fail("Only the owner or receptionist can record payments.");
  const pkg = findPackage(state, packageName);
  if (!pkg) return fail("Choose a valid package.");
  if (!PAYMENT_METHODS.includes(method)) return fail("Choose a valid payment method.");
  if (!state.people.some((person) => person.id === memberId && person.role === "member")) return fail("Choose a valid member.");
  const target = planPaymentTarget(state, memberId, packageName, today);
  if (!target.ok) return fail(target.message);
  return settle(state, newPayment(state, memberId, target.membershipId, pkg, method, "pending", nowIso), today);
}

export function confirmPayment(state: DemoState, actorRole: Role, paymentId: number, today: string): RuleResult {
  if (!STAFF_ROLES.includes(actorRole)) return fail("Only the owner or receptionist can confirm payments.");
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) return fail("Payment not found.");
  if (payment.status !== "pending") return fail(`Payment ${payment.reference} is already ${payment.status}.`);
  return settle(state, payment, today);
}

export function rejectPayment(state: DemoState, actorRole: Role, paymentId: number): RuleResult {
  if (!STAFF_ROLES.includes(actorRole)) return fail("Only the owner or receptionist can reject payments.");
  const payment = state.payments.find((item) => item.id === paymentId);
  if (!payment) return fail("Payment not found.");
  if (payment.status !== "pending") return fail(`Payment ${payment.reference} is already ${payment.status}.`);
  return {
    ok: true,
    state: { ...state, payments: state.payments.map((item) => (item.id === paymentId ? { ...item, status: "rejected" as const } : item)) },
    message: `Payment ${payment.reference} rejected. No membership was changed.`,
  };
}

// ---------------------------------------------------------------------------
// Attendance and expenses
// ---------------------------------------------------------------------------

export function toggleAttendance(state: DemoState, memberId: number, today: string, nowIso: string): RuleResult {
  const open = state.visits.find((item) => item.memberId === memberId && !item.checkedOut);
  if (open) {
    return {
      ok: true,
      state: { ...state, visits: state.visits.map((item) => (item.id === open.id ? { ...item, checkedOut: nowIso } : item)) },
      message: `${nameOf(state, memberId)} checked out.`,
    };
  }
  if (!activeMembership(state, memberId, today)) {
    return fail(`Blocked: ${nameOf(state, memberId)} has no active membership. Renew or activate a plan before check-in.`);
  }
  return {
    ok: true,
    state: { ...state, visits: [...state.visits, { id: nextId(state.visits), memberId, checkedIn: nowIso }] },
    message: `${nameOf(state, memberId)} checked in.`,
  };
}

export function addExpense(state: DemoState, category: string, amount: number, today: string): RuleResult {
  const name = category.trim();
  if (!name) return fail("Expense category is required.");
  if (!Number.isFinite(amount) || amount <= 0) return fail("Expense amount must be greater than zero.");
  return {
    ok: true,
    state: { ...state, expenses: [...state.expenses, { id: nextId(state.expenses), category: name, amount: Math.round(amount * 100) / 100, date: today }] },
    message: `${name} expense recorded.`,
  };
}

// ---------------------------------------------------------------------------
// Seed data and persisted-state validation
// ---------------------------------------------------------------------------

/** Fictional seed data with dates relative to `now`, so the demo never goes stale. */
export function createInitialState(now: Date = new Date()): DemoState {
  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  return {
    people: [
      { id: 1, name: "Amina Kamau", email: "owner@demo.gymflow", role: "owner", status: "active" },
      { id: 2, name: "Lydia Wanjiku", email: "desk@demo.gymflow", role: "receptionist", status: "active" },
      { id: 3, name: "Brian Otieno", email: "trainer@demo.gymflow", role: "trainer", status: "active" },
      { id: 4, name: "Nia Maina", email: "member@demo.gymflow", role: "member", status: "active" },
      { id: 5, name: "James Kibet", email: "james@demo.gymflow", role: "member", status: "active" },
      { id: 6, name: "Grace Achieng", email: "grace@demo.gymflow", role: "member", status: "active" },
    ],
    packages: [
      { name: "Daily", days: 1, price: 500 },
      { name: "Monthly", days: 30, price: 3800 },
      { name: "Yearly", days: 365, price: 55000 },
    ],
    memberships: [
      // Nia: monthly plan that ends in 3 days, so it shows in "Expiring this week".
      { id: 1, memberId: 4, packageName: "Monthly", startsOn: addDays(today, -26), endsOn: addDays(today, 3), status: "active" },
      // James: monthly plan that expired 4 days ago.
      { id: 2, memberId: 5, packageName: "Monthly", startsOn: addDays(today, -33), endsOn: addDays(today, -4), status: "active" },
      // Grace: yearly plan well within its term.
      { id: 3, memberId: 6, packageName: "Yearly", startsOn: addDays(today, -120), endsOn: addDays(today, 244), status: "active" },
    ],
    visits: [
      { id: 1, memberId: 4, checkedIn: localIso(yesterday, "07:42"), checkedOut: localIso(yesterday, "08:55") },
      { id: 2, memberId: 6, checkedIn: localIso(today, "06:30") },
    ],
    sessions: [{ id: 1, memberId: 4, trainerId: 3, title: "Strength foundation", startsAt: `${addDays(today, 1)}T09:00` }],
    workouts: [{ id: 1, memberId: 4, trainerId: 3, title: "Full body A", instructions: "3 rounds: squat, press, row and core." }],
    assignments: [{ id: 1, trainerId: 3, memberId: 4, active: true }],
    payments: [
      { id: 1, memberId: 4, membershipId: 1, packageName: "Monthly", amount: 3800, reference: "GF-DEMO-001", method: "M-Pesa sandbox", status: "confirmed", createdAt: localIso(addDays(today, -26), "07:30") },
      { id: 2, memberId: 5, membershipId: 2, packageName: "Monthly", amount: 3800, reference: "GF-DEMO-002", method: "Cash demo", status: "confirmed", createdAt: localIso(addDays(today, -33), "18:10") },
      { id: 3, memberId: 6, membershipId: 3, packageName: "Yearly", amount: 55000, reference: "GF-DEMO-003", method: "Card sandbox", status: "confirmed", createdAt: localIso(addDays(today, -120), "12:05") },
      // James has asked to renew from the member app; the front desk still has to confirm it.
      { id: 4, memberId: 5, membershipId: null, packageName: "Monthly", amount: 3800, reference: "GF-DEMO-004", method: "M-Pesa sandbox", status: "pending", createdAt: localIso(today, "06:15") },
    ],
    expenses: [{ id: 1, category: "Equipment", amount: 8500, date: addDays(today, -6) }],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isId = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value > 0;
const isText = (value: unknown): value is string => typeof value === "string";
const isDay = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

function list<T>(value: unknown, fallback: T[], map: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(value)) return fallback;
  return value.flatMap((item) => {
    if (!isRecord(item) || !isId(item.id)) return [];
    const mapped = map(item);
    return mapped ? [mapped] : [];
  });
}

/**
 * Parses and repairs state saved by any earlier version of the demo.
 * Falls back to fresh seed data when the payload is unreadable or the four
 * persona accounts are missing, so corrupted storage cannot crash the page.
 */
export function restoreState(saved: string | null, now: Date = new Date()): DemoState {
  const fresh = createInitialState(now);
  if (!saved) return fresh;
  let parsed: unknown;
  try {
    parsed = JSON.parse(saved);
  } catch {
    return fresh;
  }
  if (!isRecord(parsed)) return fresh;

  const people = list<Person>(parsed.people, [], (item) =>
    isText(item.name) && isText(item.email) && ROLES.includes(item.role as Role)
      ? { id: item.id as number, name: item.name, email: item.email, role: item.role as Role, status: "active" }
      : null,
  );
  const personasPresent = ROLES.every((role) => people.some((person) => person.id === PERSONA_IDS[role] && person.role === role));
  if (!personasPresent) return fresh;

  const packages = Array.isArray(parsed.packages)
    ? parsed.packages.flatMap((item): Package[] =>
        isRecord(item) && isText(item.name) && typeof item.days === "number" && item.days >= 1 && typeof item.price === "number" && item.price >= 0
          ? [{ name: item.name, days: Math.floor(item.days), price: item.price }]
          : [],
      )
    : [];
  const safePackages = packages.length > 0 ? packages : fresh.packages;
  const daysFor = (name: string) => safePackages.find((item) => item.name === name)?.days ?? 30;

  const memberships = list<Membership>(parsed.memberships, fresh.memberships, (item) => {
    if (!isId(item.memberId) || !isText(item.packageName) || !isDay(item.endsOn)) return null;
    const startsOn = isDay(item.startsOn) ? item.startsOn : addDays(item.endsOn, -(daysFor(item.packageName) - 1));
    return { id: item.id as number, memberId: item.memberId, packageName: item.packageName, startsOn, endsOn: item.endsOn, status: item.status === "cancelled" ? "cancelled" : "active" };
  });

  const payments = list<Payment>(parsed.payments, fresh.payments, (item) => {
    if (!isId(item.memberId) || !isText(item.packageName) || typeof item.amount !== "number") return null;
    const legacyLink = memberships.find((membership) => membership.memberId === item.memberId && membership.packageName === item.packageName);
    const membershipId = isId(item.membershipId) ? item.membershipId : item.membershipId === null ? null : legacyLink?.id ?? null;
    const status: PaymentStatus = item.status === "pending" || item.status === "rejected" ? item.status : "confirmed";
    return {
      id: item.id as number,
      memberId: item.memberId,
      membershipId,
      packageName: item.packageName,
      amount: item.amount,
      reference: isText(item.reference) ? item.reference : reference(item.id as number),
      method: PAYMENT_METHODS.includes(item.method as PaymentMethod) ? (item.method as PaymentMethod) : "Cash demo",
      status,
      createdAt: isText(item.createdAt) ? item.createdAt : "",
    };
  });

  return {
    people,
    packages: safePackages,
    memberships,
    payments,
    visits: list<Visit>(parsed.visits, fresh.visits, (item) =>
      isId(item.memberId) && isText(item.checkedIn)
        ? { id: item.id as number, memberId: item.memberId, checkedIn: item.checkedIn, ...(isText(item.checkedOut) ? { checkedOut: item.checkedOut } : {}) }
        : null,
    ),
    sessions: list<Session>(parsed.sessions, fresh.sessions, (item) =>
      isId(item.memberId) && isId(item.trainerId) && isText(item.title) && isText(item.startsAt)
        ? { id: item.id as number, memberId: item.memberId, trainerId: item.trainerId, title: item.title, startsAt: item.startsAt }
        : null,
    ),
    workouts: list<Workout>(parsed.workouts, fresh.workouts, (item) =>
      isId(item.memberId) && isId(item.trainerId) && isText(item.title) && isText(item.instructions)
        ? { id: item.id as number, memberId: item.memberId, trainerId: item.trainerId, title: item.title, instructions: item.instructions }
        : null,
    ),
    assignments: list<Assignment>(parsed.assignments, fresh.assignments, (item) =>
      isId(item.memberId) && isId(item.trainerId) ? { id: item.id as number, memberId: item.memberId, trainerId: item.trainerId, active: item.active !== false } : null,
    ),
    expenses: list<Expense>(parsed.expenses, fresh.expenses, (item) =>
      isText(item.category) && typeof item.amount === "number" && Number.isFinite(item.amount) && isText(item.date)
        ? { id: item.id as number, category: item.category, amount: item.amount, date: item.date }
        : null,
    ),
  };
}
