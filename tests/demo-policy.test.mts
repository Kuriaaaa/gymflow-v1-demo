import assert from "node:assert/strict";
import test from "node:test";
import { assignedMemberIds, canTrainerManageMember, hasActiveAssignment } from "../app/demo-policy.ts";

const assignments = [
  { id: 1, trainerId: 10, memberId: 20, active: true },
  { id: 2, trainerId: 10, memberId: 21, active: false },
  { id: 3, trainerId: 11, memberId: 22, active: true },
];

test("trainer visibility contains active assignments only", () => {
  assert.deepEqual([...assignedMemberIds(assignments, 10)], [20]);
  assert.deepEqual([...assignedMemberIds(assignments, 11)], [22]);
});

test("trainer cannot manage an unassigned or inactive member", () => {
  assert.equal(canTrainerManageMember(assignments, 10, 20), true);
  assert.equal(canTrainerManageMember(assignments, 10, 21), false);
  assert.equal(canTrainerManageMember(assignments, 10, 22), false);
});

test("duplicate active trainer assignment is detected", () => {
  assert.equal(hasActiveAssignment(assignments, 10, 20), true);
  assert.equal(hasActiveAssignment(assignments, 10, 21), false);
});
