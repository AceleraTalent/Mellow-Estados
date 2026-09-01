"use client";

import { useTransition } from "react";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { TaskStatus } from "@prisma/client";
import { moveTaskAction } from "@/app/actions";

type BoardTask = {
  id: string;
  title: string;
  client: string;
  stage: string;
  status: TaskStatus;
  due: string;
};

const statuses = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED, TaskStatus.COMPLETED];

function TaskCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div className="board-card" ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <strong>{task.title}</strong>
      <p className="muted" style={{ margin: "5px 0" }}>{task.client} · {task.stage}</p>
      <p className="muted" style={{ margin: 0 }}>{task.due}</p>
    </div>
  );
}

function StatusColumn({ status, tasks }: { status: TaskStatus; tasks: BoardTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="board-column" ref={setNodeRef} style={{ outline: isOver ? "2px solid var(--accent)" : undefined }}>
      <strong>{status.replace("_", " ")}</strong>
      <p className="muted" style={{ margin: "4px 0 8px" }}>{tasks.length} tasks</p>
      {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
    </div>
  );
}

export function TaskBoard({ tasks }: { tasks: BoardTask[] }) {
  const [, startTransition] = useTransition();

  function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const status = event.over?.id as TaskStatus | undefined;
    if (!status || !statuses.includes(status)) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.status === status) return;
    startTransition(async () => {
      await moveTaskAction(taskId, status);
    });
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="board">
        {statuses.map((status) => (
          <StatusColumn key={status} status={status} tasks={tasks.filter((task) => task.status === status)} />
        ))}
      </div>
    </DndContext>
  );
}
