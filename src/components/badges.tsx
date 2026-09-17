import { TaskPriority, TaskStatus } from "@prisma/client";

export function HealthBadge({ value }: { value: string }) {
  const className =
    value === "Delayed" || value === "Blocked" ? "delayed" : value === "Due soon" ? "due-soon" : value === "Completed" ? "completed" : "on-track";
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

export function Progress({ value, variant }: { value: number; variant?: "large" }) {
  const safeValue = Math.min(100, Math.max(0, value));
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
      <div className={`progress ${variant === "large" ? "progress-large" : ""}`}>
        <span style={{ width: `${safeValue}%` }} />
      </div>
      <span className="muted">{safeValue}%</span>
    </div>
  );
}
