import type { Stage } from "@prisma/client";
import { addDays } from "./dates";

type TimelineStage = Pick<Stage, "id" | "position" | "defaultDurationDays" | "parallelGroup">;

export function buildPlannedTimeline(stages: TimelineStage[], startDate: Date) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  let cursor = startDate;

  return ordered.map((stage, index) => {
    const previous = ordered[index - 1];
    // Stages in the same group start together. The stage after the group starts
    // only when the longest parallel path is expected to be finished.
    if (previous?.parallelGroup && previous.parallelGroup === stage.parallelGroup) {
      cursor = startDateForGroup(ordered, index, cursor);
    }
    const plannedStartDate = cursor;
    const plannedEndDate = addDays(plannedStartDate, stage.defaultDurationDays - 1);
    const next = ordered[index + 1];
    if (!next || next.parallelGroup !== stage.parallelGroup) cursor = addDays(plannedEndDate, 1);

    return {
      stageId: stage.id,
      position: stage.position,
      plannedStartDate,
      plannedEndDate,
      durationDaysSnapshot: stage.defaultDurationDays,
    };
  });
}

function startDateForGroup(stages: TimelineStage[], index: number, fallback: Date) {
  const group = stages[index].parallelGroup;
  const first = stages.findIndex((stage) => stage.parallelGroup === group);
  if (first < 0 || first === index) return fallback;
  // The prior member has the group's shared planned start date.
  return addDays(fallback, -(stages[index - 1].defaultDurationDays));
}
