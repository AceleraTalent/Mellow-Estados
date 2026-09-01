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
