"use client";

import { useTransition } from "react";
import { TaskStatus } from "@prisma/client";
import { updateTaskStatusAction } from "@/app/actions";

export function TaskCompleteCheckbox({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const [pending, startTransition] = useTransition();
  const checked = status === TaskStatus.COMPLETED;

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      onChange={() => {
        startTransition(() => {
          updateTaskStatusAction(taskId, checked ? TaskStatus.PENDING : TaskStatus.COMPLETED);
        });
      }}
    />
  );
}
