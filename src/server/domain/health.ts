import { ClientStatus, ClientStageStatus } from "@prisma/client";
import { daysInclusive, daysRemaining } from "./dates";

export type Health = "Completed" | "Blocked" | "Delayed" | "Due soon" | "On track";

export function getStageHealth(input: {
  clientStatus?: ClientStatus;
  stageStatus?: ClientStageStatus;
  plannedEndDate?: Date | null;
  dueSoonDays?: number;
  hasBlockedTasks?: boolean;
  today?: Date;
}): Health {
  if (input.clientStatus === ClientStatus.COMPLETED || input.stageStatus === ClientStageStatus.COMPLETED) {
    return "Completed";
  }
  if (input.stageStatus === ClientStageStatus.BLOCKED || input.hasBlockedTasks) return "Blocked";

  const remaining = daysRemaining(input.plannedEndDate, input.today);
  if (remaining < 0) return "Delayed";
  if (remaining <= (input.dueSoonDays ?? 3)) return "Due soon";
  return "On track";
}

export function getStageTiming(input: {
  actualStartDate?: Date | null;
  plannedStartDate?: Date | null;
  plannedEndDate?: Date | null;
  durationDays: number;
}) {
  const start = input.actualStartDate ?? input.plannedStartDate;
  const inStage = daysInclusive(start);
  const remaining = daysRemaining(input.plannedEndDate);
  return {
    inStage,
    remaining,
    overdue: Math.max(0, -remaining),
    label: remaining < 0 ? `${Math.abs(remaining)} days overdue` : `${remaining} days remaining`,
    dayLabel: `Day ${inStage} / ${input.durationDays}`,
  };
}
