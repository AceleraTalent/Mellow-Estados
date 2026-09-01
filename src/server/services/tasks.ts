import { EntityType, Prisma, TaskPriority, TaskStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { canEditTask } from "@/server/auth";
import { prisma } from "@/server/db";

export type TaskFilters = {
  view?: string;
  q?: string;
  clientId?: string;
  status?: string;
  priority?: string;
};

export async function getTaskList(user: { id: string; role: UserRole; teamId: string | null }, filters: TaskFilters = {}) {
  const today = new Date();
  const inSevenDays = new Date();
  inSevenDays.setDate(today.getDate() + 7);
  const and: Prisma.TaskWhereInput[] = [];

  if (user.role !== UserRole.ADMIN) {
    and.push({ OR: [{ assignedUserId: user.id }, ...(user.teamId ? [{ assignedTeamId: user.teamId }] : [])] });
  }
  if (filters.q) {
    and.push({
      OR: [
        { title: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
        { client: { name: { contains: filters.q, mode: Prisma.QueryMode.insensitive } } },
        { client: { companyName: { contains: filters.q, mode: Prisma.QueryMode.insensitive } } },
      ],
    });
  }

  const where: Prisma.TaskWhereInput = {
    archivedAt: null,
    ...(and.length ? { AND: and } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.status ? { status: filters.status as TaskStatus } : {}),
    ...(filters.priority ? { priority: filters.priority as TaskPriority } : {}),
    ...(filters.view === "my" ? { assignedUserId: user.id } : {}),
    ...(filters.view === "overdue" ? { dueDate: { lt: today }, status: { not: TaskStatus.COMPLETED } } : {}),
    ...(filters.view === "due-soon" ? { dueDate: { gte: today, lte: inSevenDays }, status: { not: TaskStatus.COMPLETED } } : {}),
    ...(filters.view === "completed" ? { status: TaskStatus.COMPLETED } : {}),
  };

  return prisma.task.findMany({
    where,
    include: {
      client: true,
      clientStage: { include: { stage: true } },
      assignedUser: true,
      assignedTeam: true,
    },
    orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { sortOrder: "asc" }],
    take: 200,
  });
}

export async function createTask(input: {
  actorId: string;
  clientId: string;
  clientStageId: string;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedUserId?: string | null;
  assignedTeamId?: string | null;
  dueDate?: Date | null;
}) {
  const task = await prisma.$transaction(async (tx) => {
    const lastTask = await tx.task.findFirst({
      where: { clientStageId: input.clientStageId, archivedAt: null },
      orderBy: { sortOrder: "desc" },
    });
    const created = await tx.task.create({
      data: {
        clientId: input.clientId,
        clientStageId: input.clientStageId,
        title: input.title,
        description: input.description,
        status: input.status ?? TaskStatus.PENDING,
        priority: input.priority ?? TaskPriority.MEDIUM,
        assignedUserId: input.assignedUserId,
        assignedTeamId: input.assignedTeamId,
        dueDate: input.dueDate,
        sortOrder: (lastTask?.sortOrder ?? 0) + 10,
        createdById: input.actorId,
      },
    });
    await tx.activityLog.create({
      data: {
        actorId: input.actorId,
        action: "TASK_CREATED",
        entityType: EntityType.TASK,
        entityId: created.id,
        clientId: created.clientId,
        clientStageId: created.clientStageId,
        taskId: created.id,
      },
    });
    return created;
  });

  revalidatePath("/tasks");
  revalidatePath(`/clients/${input.clientId}`);
  revalidatePath("/clients");
  return task;
}

export async function updateTask(input: {
  actor: { id: string; role: UserRole; teamId: string | null };
  taskId: string;
  data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    assignedUserId?: string | null;
    assignedTeamId?: string | null;
    clientStageId?: string;
    dueDate?: Date | null;
  };
}) {
  const result = await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: input.taskId } });
    if (!task) throw new Error("Task not found");
    if (!canEditTask(input.actor, task)) throw new Error("Not authorized to edit this task");

    if (input.data.clientStageId) {
      const targetStage = await tx.clientStage.findUnique({ where: { id: input.data.clientStageId } });
      if (!targetStage || targetStage.clientId !== task.clientId) {
        throw new Error("Task can only move between stages for the same client");
      }
    }

    const updated = await tx.task.update({
      where: { id: input.taskId },
      data: {
        ...input.data,
        completedAt: input.data.status === TaskStatus.COMPLETED ? new Date() : input.data.status ? null : undefined,
      },
    });

    await tx.activityLog.create({
      data: {
        actorId: input.actor.id,
        action: "TASK_UPDATED",
        entityType: EntityType.TASK,
        entityId: task.id,
        clientId: task.clientId,
        clientStageId: updated.clientStageId,
        taskId: task.id,
        previousValue: { status: task.status, priority: task.priority, clientStageId: task.clientStageId },
        newValue: { status: updated.status, priority: updated.priority, clientStageId: updated.clientStageId },
      },
    });

    return updated;
  });

  revalidatePath("/tasks");
  revalidatePath(`/clients/${result.clientId}`);
  revalidatePath("/clients");
  return result;
}

export async function moveTask(input: {
  actor: { id: string; role: UserRole; teamId: string | null };
  taskId: string;
  status?: TaskStatus;
  clientStageId?: string;
  sortOrder?: number;
}) {
  return updateTask({
    actor: input.actor,
    taskId: input.taskId,
    data: {
      status: input.status,
      clientStageId: input.clientStageId,
    },
  }).then(async (task) => {
    if (typeof input.sortOrder === "number") {
      await prisma.task.update({ where: { id: input.taskId }, data: { sortOrder: input.sortOrder } });
    }
    return task;
  });
}
