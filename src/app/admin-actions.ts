"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { TaskPriority, UserRole } from "@prisma/client";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : null;
}

export async function createTeamAction(formData: FormData) {
  await requireAdmin();
  await prisma.team.create({
    data: {
      name: String(formData.get("name") ?? "").trim(),
      description: optional(formData.get("description")),
    },
  });
  revalidatePath("/teams");
  revalidatePath("/admin");
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const password = String(formData.get("password") ?? "mellow123");
  await prisma.user.create({
    data: {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim().toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: String(formData.get("role") ?? "MEMBER") as UserRole,
      teamId: optional(formData.get("teamId")),
    },
  });
  revalidatePath("/admin");
}

export async function updateStageAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.stage.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? "").trim(),
      description: optional(formData.get("description")),
      defaultDurationDays: Number(formData.get("defaultDurationDays") ?? 1),
      active: formData.get("active") === "on",
    },
  });
  revalidatePath("/admin");
  revalidatePath("/clients");
}

export async function createTaskTemplateAction(formData: FormData) {
  await requireAdmin();
  await prisma.taskTemplate.create({
    data: {
      stageId: String(formData.get("stageId")),
      title: String(formData.get("title") ?? "").trim(),
      description: optional(formData.get("description")),
      priority: String(formData.get("priority") ?? "MEDIUM") as TaskPriority,
      defaultAssignedTeamId: optional(formData.get("defaultAssignedTeamId")),
      startOffsetDays: Number(formData.get("startOffsetDays") ?? 0),
      dueOffsetDays: Number(formData.get("dueOffsetDays") ?? 3),
      sortOrder: Number(formData.get("sortOrder") ?? 0),
    },
  });
  revalidatePath("/admin");
}
