import type { Stage } from "@prisma/client";
import { addDays } from "./dates";

export function buildPlannedTimeline(stages: Pick<Stage, "id" | "position" | "defaultDurationDays">[], startDate: Date) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  let cursor = startDate;

  return ordered.map((stage) => {
    const plannedStartDate = cursor;
    const plannedEndDate = addDays(plannedStartDate, stage.defaultDurationDays - 1);
    cursor = addDays(plannedEndDate, 1);

    return {
      stageId: stage.id,
      position: stage.position,
      plannedStartDate,
      plannedEndDate,
      durationDaysSnapshot: stage.defaultDurationDays,
    };
  });
}
