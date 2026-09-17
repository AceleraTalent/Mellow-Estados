import { TaskStatus } from "@prisma/client";

export function percent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

export function taskCounts<T extends { status: TaskStatus; archivedAt?: Date | null }>(tasks: T[]) {
  const activeTasks = tasks.filter((task) => !task.archivedAt);
  const completed = activeTasks.filter((task) => task.status === TaskStatus.COMPLETED).length;
  return {
    total: activeTasks.length,
    completed,
    pending: activeTasks.length - completed,
    progress: percent(completed, activeTasks.length),
  };
}

/**
 * Project progress is deliberately derived, never persisted.  Completed
 * milestones each account for one equal share and the active milestone adds
 * its completed-task fraction.  Stages after the current pointer are ignored
 * so moving a client backwards remains possible without destroying history.
 */
export function projectProgress<T extends {
  id: string;
  position: number;
  status: string;
  tasks: { status: TaskStatus; archivedAt?: Date | null }[];
}>(stages: T[], currentStageId?: string | null) {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  if (!ordered.length || !currentStageId) return 0;
  const currentIndex = ordered.findIndex((stage) => stage.id === currentStageId);
  if (currentIndex < 0) return 0;

  const completedBeforeCurrent = ordered
    .slice(0, currentIndex)
    .filter((stage) => stage.status === "COMPLETED").length;
  const current = taskCounts(ordered[currentIndex].tasks);
  const raw = ((completedBeforeCurrent + current.progress / 100) / ordered.length) * 100;
  return Math.round(Math.min(100, Math.max(0, raw)));
}
