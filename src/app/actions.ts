"use server";

import { TaskPriority, TaskStatus, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireAdmin, requireUser } from "@/server/auth";
import { createClientWithTimeline, advanceClientStage } from "@/server/services/clients";
import { createTask, moveTask, updateTask } from "@/server/services/tasks";

function stringOrNull(value: FormDataEntryValue | null) {
  const string = String(value ?? "").trim();
  return string.length > 0 ? string : null;
}

export async function createClientAction(formData: FormData) {
  const user = await requireAdmin();
  const client = await createClientWithTimeline({
    actorId: user.id,
    name: String(formData.get("name") ?? "").trim(),
    companyName: String(formData.get("companyName") ?? "").trim(),
    email: stringOrNull(formData.get("email")),
    phone: stringOrNull(formData.get("phone")),
    ownerId: stringOrNull(formData.get("ownerId")),
    teamId: stringOrNull(formData.get("teamId")),
    startDate: new Date(String(formData.get("startDate") ?? "")),
  });

  redirect(`/clients/${client.id}`);
}

export async function advanceClientAction(formData: FormData) {
  const user = await requireAdmin();
  const clientId = String(formData.get("clientId"));
  await advanceClientStage({
    actorId: user.id,
    clientId,
    confirmPendingTasks: formData.get("confirmPendingTasks") === "on" || formData.get("confirmPendingTasks") === "true",
  });
}

export async function advanceClientFromBoard(clientId: string, targetClientStageId: string) {
  const user = await requireAdmin();
  return advanceClientStage({
    actorId: user.id,
    clientId,
    targetClientStageId,
    confirmPendingTasks: true,
  });
}

export async function createTaskAction(formData: FormData) {
  const user = await requireUser();
  await createTask({
    actorId: user.id,
    clientId: String(formData.get("clientId")),
    clientStageId: String(formData.get("clientStageId")),
    title: String(formData.get("title") ?? "").trim(),
    description: stringOrNull(formData.get("description")),
    priority: (String(formData.get("priority") ?? "MEDIUM") as TaskPriority) || TaskPriority.MEDIUM,
    assignedUserId: stringOrNull(formData.get("assignedUserId")),
    assignedTeamId: stringOrNull(formData.get("assignedTeamId")),
    dueDate: stringOrNull(formData.get("dueDate")) ? new Date(String(formData.get("dueDate"))) : null,
  });
}

export async function updateTaskStatusAction(taskId: string, status: TaskStatus) {
  const user = await requireUser();
  await updateTask({ actor: { id: user.id, role: user.role, teamId: user.teamId }, taskId, data: { status } });
}

export async function moveTaskAction(taskId: string, status: TaskStatus) {
  const user = await requireUser();
  await moveTask({ actor: { id: user.id, role: user.role, teamId: user.teamId }, taskId, status });
}

export async function requireAdminRole() {
  const user = await requireUser();
  return user.role === UserRole.ADMIN;
}
