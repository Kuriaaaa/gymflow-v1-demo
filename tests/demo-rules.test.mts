import assert from "node:assert/strict";
import test from "node:test";
import {
  activateMembership,
  activeMembership,
  addDays,
  addExpense,
  cancelMembership,
  confirmPayment,
  createInitialState,
  dayKey,
  expiringWithin,
  membershipStatus,
  recordPayment,
  rejectPayment,
  renewMembership,
  requestPayment,
  restoreState,
  toggleAttendance,
  type DemoState,
  type RuleResult,
} from "../app/demo-rules.ts";

const NOW = new Date(2026, 9, 5, 10, 0); // 5 Oct 2026, local time
const TODAY = dayKey(NOW);
const NOW_ISO = NOW.toISOString();

function ok(result: RuleResult): DemoState {
  if (!result.ok) assert.fail(`expected the rule to succeed: ${result.message}`);
  return result.state;
}

function blocked(result: RuleResult, pattern: RegExp) {
  assert.equal(result.ok, false, "expected the rule to block");
  assert.match(result.message, pattern);
}

test("date helpers are timezone safe", () => {
  assert.equal(TODAY, "2026-10-05");
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("seed data is relative to today so memberships are current", () => {
  const state = createInitialState(NOW);
  const [nia, james, grace] = state.memberships;
  assert.equal(membershipStatus(nia, TODAY), "active");
  assert.equal(nia.endsOn, "2026-10-08");
  assert.equal(membershipStatus(james, TODAY), "expired");
  assert.equal(membershipStatus(grace, TODAY), "active");
  assert.deepEqual(expiringWithin(state, TODAY).map((item) => item.memberId), [4]);
});

test("memberships expire after their inclusive end date", () => {
  const membership = { id: 1, memberId: 4, packageName: "Daily", startsOn: TODAY, endsOn: TODAY, status: "active" as const };
  assert.equal(membershipStatus(membership, TODAY), "active");
  assert.equal(membershipStatus(membership, addDays(TODAY, 1)), "expired");
  assert.equal(membershipStatus(membership, addDays(TODAY, -1)), "upcoming");
  assert.equal(membershipStatus({ ...membership, status: "cancelled" }, TODAY), "cancelled");
});

test("only one open membership per member; expired members can be activated again", () => {
  const state = createInitialState(NOW);
  blocked(activateMembership(state, 4, "Monthly", TODAY), /already has an active or queued membership/);
  const next = ok(activateMembership(state, 5, "Monthly", TODAY));
  const created = next.memberships.at(-1)!;
  assert.equal(created.startsOn, TODAY);
  assert.equal(created.endsOn, addDays(TODAY, 29));
});

test("renewal queues the next period and its payment is not blocked as a duplicate", () => {
  let state = createInitialState(NOW);
  state = ok(renewMembership(state, 1, TODAY));
  const renewal = state.memberships.at(-1)!;
  assert.equal(renewal.startsOn, "2026-10-09");
  assert.equal(membershipStatus(renewal, TODAY), "upcoming");
  blocked(renewMembership(state, 1, TODAY), /renewal is already queued/);
  assert.deepEqual(expiringWithin(state, TODAY), [], "renewed members leave the expiring list");

  // Same member, same package as an already-paid membership: still allowed because it links by membership id.
  state = ok(recordPayment(state, "receptionist", 4, "Monthly", "Cash demo", TODAY, NOW_ISO));
  const payment = state.payments.at(-1)!;
  assert.equal(payment.membershipId, renewal.id);
  assert.equal(payment.status, "confirmed");
  blocked(recordPayment(state, "receptionist", 4, "Monthly", "Cash demo", TODAY, NOW_ISO), /already queued and paid/);
});

test("payment package must match the membership awaiting payment", () => {
  const state = ok(activateMembership(createInitialState(NOW), 5, "Monthly", TODAY));
  blocked(recordPayment(state, "owner", 5, "Yearly", "Cash demo", TODAY, NOW_ISO), /differs from the Monthly membership/);
});

test("members can only request payments; staff confirm or reject them", () => {
  let state = createInitialState(NOW);
  state = ok(requestPayment(state, 4, "Monthly", "M-Pesa sandbox", TODAY, NOW_ISO));
  const request = state.payments.at(-1)!;
  assert.equal(request.status, "pending");
  assert.equal(request.membershipId, null);
  assert.equal(state.memberships.length, 3, "a pending request does not change memberships");
  blocked(requestPayment(state, 4, "Monthly", "M-Pesa sandbox", TODAY, NOW_ISO), /awaiting confirmation/);

  blocked(confirmPayment(state, "member", request.id, TODAY), /Only the owner or receptionist/);
  blocked(confirmPayment(state, "trainer", request.id, TODAY), /Only the owner or receptionist/);
  blocked(recordPayment(state, "member", 4, "Monthly", "Cash demo", TODAY, NOW_ISO), /Only the owner or receptionist/);

  const confirmed = ok(confirmPayment(state, "receptionist", request.id, TODAY));
  const renewal = confirmed.memberships.at(-1)!;
  assert.equal(renewal.startsOn, "2026-10-09");
  assert.equal(confirmed.payments.find((item) => item.id === request.id)!.membershipId, renewal.id);
  blocked(confirmPayment(confirmed, "owner", request.id, TODAY), /already confirmed/);

  const rejected = ok(rejectPayment(state, "owner", request.id));
  assert.equal(rejected.payments.find((item) => item.id === request.id)!.status, "rejected");
  assert.equal(rejected.memberships.length, 3);
});

test("confirming an expired member's request starts a membership today", () => {
  const state = createInitialState(NOW);
  const pending = state.payments.find((item) => item.status === "pending")!;
  const next = ok(confirmPayment(state, "owner", pending.id, TODAY));
  assert.equal(activeMembership(next, pending.memberId, TODAY)?.startsOn, TODAY);
});

test("cancelling a membership rejects its pending payments", () => {
  let state = ok(activateMembership(createInitialState(NOW), 5, "Monthly", TODAY));
  const membership = state.memberships.at(-1)!;
  // Remove the seeded pending request so the member can request the new membership.
  state = ok(rejectPayment(state, "receptionist", 4));
  state = ok(requestPayment(state, 5, "Monthly", "Card sandbox", TODAY, NOW_ISO));
  assert.equal(state.payments.at(-1)!.membershipId, membership.id);
  state = ok(cancelMembership(state, membership.id, TODAY));
  assert.equal(membershipStatus(state.memberships.at(-1)!, TODAY), "cancelled");
  assert.equal(state.payments.at(-1)!.status, "rejected");
  blocked(cancelMembership(state, membership.id, TODAY), /already cancelled/);
});

test("check-in requires an active membership and stores ISO timestamps", () => {
  const state = createInitialState(NOW);
  blocked(toggleAttendance(state, 5, TODAY, NOW_ISO), /no active membership/);
  const inside = ok(toggleAttendance(state, 4, TODAY, NOW_ISO));
  const visit = inside.visits.at(-1)!;
  assert.equal(visit.checkedIn, NOW_ISO);
  assert.ok(!Number.isNaN(Date.parse(visit.checkedIn)));
  const out = ok(toggleAttendance(inside, 4, TODAY, NOW_ISO));
  assert.equal(out.visits.at(-1)!.checkedOut, NOW_ISO);
});

test("expenses must have a positive amount", () => {
  const state = createInitialState(NOW);
  blocked(addExpense(state, "Rent", 0, TODAY), /greater than zero/);
  blocked(addExpense(state, "Rent", -50, TODAY), /greater than zero/);
  blocked(addExpense(state, "Rent", Number.NaN, TODAY), /greater than zero/);
  blocked(addExpense(state, "  ", 100, TODAY), /category is required/);
  const next = ok(addExpense(state, "Rent", 25000, TODAY));
  assert.deepEqual(next.expenses.at(-1), { id: 2, category: "Rent", amount: 25000, date: TODAY });
});

test("ids are sequential", () => {
  const state = ok(addExpense(ok(addExpense(createInitialState(NOW), "A", 1, TODAY)), "B", 1, TODAY));
  assert.deepEqual(state.expenses.map((item) => item.id), [1, 2, 3]);
});

test("corrupted or incomplete storage falls back to fresh seed data", () => {
  const fresh = createInitialState(NOW);
  assert.deepEqual(restoreState(null, NOW), fresh);
  assert.deepEqual(restoreState("not json", NOW), fresh);
  assert.deepEqual(restoreState("[]", NOW), fresh);
  assert.deepEqual(restoreState('{"people": []}', NOW), fresh);
  const missingTrainer = { ...fresh, people: fresh.people.filter((person) => person.id !== 3) };
  assert.deepEqual(restoreState(JSON.stringify(missingTrainer), NOW), fresh);
  const wrongRole = { ...fresh, people: fresh.people.map((person) => (person.id === 1 ? { ...person, role: "member" } : person)) };
  assert.deepEqual(restoreState(JSON.stringify(wrongRole), NOW), fresh);
});

test("valid storage round-trips and legacy payments are migrated", () => {
  const fresh = createInitialState(NOW);
  assert.deepEqual(restoreState(JSON.stringify(fresh), NOW), fresh);

  const legacy = {
    ...fresh,
    memberships: [{ id: 1, memberId: 4, packageName: "Monthly", endsOn: "2026-08-30", status: "active" }],
    payments: [{ id: 1, memberId: 4, packageName: "Monthly", amount: 3800, reference: "GF-DEMO-001" }],
    visits: [{ id: 1, memberId: 4, checkedIn: "Now" }, { bad: true }],
    expenses: "nope",
  };
  const restored = restoreState(JSON.stringify(legacy), NOW);
  assert.equal(restored.memberships[0].startsOn, "2026-08-01");
  assert.equal(membershipStatus(restored.memberships[0], TODAY), "expired");
  assert.deepEqual(restored.payments[0], {
    id: 1, memberId: 4, membershipId: 1, packageName: "Monthly", amount: 3800, reference: "GF-DEMO-001", method: "Cash demo", status: "confirmed", createdAt: "",
  });
  assert.equal(restored.visits.length, 1);
  assert.deepEqual(restored.expenses, fresh.expenses);
});
