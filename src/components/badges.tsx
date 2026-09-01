import { TaskPriority, TaskStatus } from "@prisma/client";

export function HealthBadge({ value }: { value: string }) {
  const className =
    value === "Delayed" ? "delayed" : value === "Due soon" ? "due-soon" : value === "Completed" ? "completed" : "on-track";
  return <span className={`badge ${className}`}>{value}</span>;
}

export function TaskStatusBadge({ value }: { value: TaskStatus }) {
  const label = value.replace("_", " ").toLowerCase();
  const className = value === TaskStatus.BLOCKED ? "blocked" : value === TaskStatus.COMPLETED ? "completed" : "neutral";
  return <span className={`badge ${className}`}>{label}</span>;
}

export function PriorityBadge({ value }: { value: TaskPriority }) {
  const className = value === TaskPriority.URGENT || value === TaskPriority.HIGH ? "urgent" : "neutral";
  return <span className={`badge ${className}`}>{value.toLowerCase()}</span>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
      <div className="progress">
        <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="muted">{value}%</span>
    </div>
  );
}
