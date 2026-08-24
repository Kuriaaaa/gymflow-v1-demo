export type Assignment = { id: number; trainerId: number; memberId: number; active: boolean };

export function assignedMemberIds(assignments: Assignment[], trainerId: number) {
  return new Set(assignments.filter((item) => item.active && item.trainerId === trainerId).map((item) => item.memberId));
}

export function canTrainerManageMember(assignments: Assignment[], trainerId: number, memberId: number) {
  return assignments.some((item) => item.active && item.trainerId === trainerId && item.memberId === memberId);
}

export function hasActiveAssignment(assignments: Assignment[], trainerId: number, memberId: number) {
  return canTrainerManageMember(assignments, trainerId, memberId);
}
