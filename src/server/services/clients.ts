import { ClientStageStatus, ClientStatus, EntityType, Prisma, TaskStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { buildPlannedTimeline } from "@/server/domain/timeline";
import { getStageHealth, getStageTiming } from "@/server/domain/health";
import { taskCounts } from "@/server/domain/progress";
import { canViewClient } from "@/server/auth";

export type ClientListFilters = {
  q?: string;
  stageId?: string;
  health?: string;
  ownerId?: string;
  teamId?: string;
  sort?: string;
};

export async function getClientList(user: { id: string; role: UserRole; teamId: string | null }, filters: ClientListFilters = {}) {
  const and: Prisma.ClientWhereInput[] = [];
  if (user.role !== UserRole.ADMIN) {
    and.push({ OR: [{ ownerId: user.id }, ...(user.teamId ? [{ teamId: user.teamId }] : [])] });
  }
  if (filters.q) {
    and.push({
      OR: [
        { name: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
        { companyName: { contains: filters.q, mode: Prisma.QueryMode.insensitive } },
        { owner: { name: { contains: filters.q, mode: Prisma.QueryMode.insensitive } } },
      ],
    });
  }

  const where: Prisma.ClientWhereInput = {
    archivedAt: null,
    ...(and.length ? { AND: and } : {}),
    ...(filters.ownerId ? { ownerId: filters.ownerId } : {}),
    ...(filters.teamId ? { teamId: filters.teamId } : {}),
    ...(filters.stageId ? { currentClientStage: { stageId: filters.stageId } } : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    include: {
      owner: true,
      team: true,
      currentClientStage: { include: { stage: true, tasks: { where: { archivedAt: null } } } },
      tasks: { where: { archivedAt: null } },
      activities: { orderBy: { createdAt: "desc" }, take: 1, include: { actor: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });

  const rows = clients.map((client) => {
    const current = client.currentClientStage;
    const stageCounts = taskCounts(current?.tasks ?? []);
    const clientCounts = taskCounts(client.tasks);
    const health = getStageHealth({
      clientStatus: client.status,
      stageStatus: current?.status,
      plannedEndDate: current?.plannedEndDate,
      hasBlockedTasks: (current?.tasks ?? []).some((task) => task.status === TaskStatus.BLOCKED),
    });
    const timing = getStageTiming({
      actualStartDate: current?.actualStartDate,
      plannedStartDate: current?.plannedStartDate,
      plannedEndDate: current?.plannedEndDate,
      durationDays: current?.durationDaysSnapshot ?? 0,
    });

    return {
      id: client.id,
      name: client.name,
      companyName: client.companyName,
      status: client.status,
      owner: client.owner,
      team: client.team,
      currentStage: current,
      stage: current?.stage,
      stageProgress: stageCounts.progress,
      clientProgress: clientCounts.progress,
      openTasks: clientCounts.pending,
      health,
      timing,
      deadline: current?.plannedEndDate,
      lastActivity: client.activities[0],
    };
  });

  const filtered = filters.health ? rows.filter((row) => row.health === filters.health) : rows;

  return filtered.sort((a, b) => {
    if (filters.sort === "deadline") return (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0);
    if (filters.sort === "progress") return a.clientProgress - b.clientProgress;
    if (filters.sort === "days") return b.timing.inStage - a.timing.inStage;
    if (filters.sort === "name") return a.name.localeCompare(b.name);
    const rank = { Delayed: 0, "Due soon": 1, "On track": 2, Completed: 3 } as Record<string, number>;
    return rank[a.health] - rank[b.health] || (a.deadline?.getTime() ?? 0) - (b.deadline?.getTime() ?? 0);
  });
}

export async function getClientDetail(id: string, user: { id: string; role: UserRole; teamId: string | null }) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      owner: true,
      team: true,
      stages: { include: { stage: true, tasks: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" } } }, orderBy: { position: "asc" } },
      currentClientStage: { include: { stage: true, tasks: { where: { archivedAt: null } } } },
      tasks: { where: { archivedAt: null }, include: { assignedUser: true, assignedTeam: true, clientStage: { include: { stage: true } } }, orderBy: [{ clientStage: { position: "asc" } }, { sortOrder: "asc" }] },
      activities: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!client || !canViewClient(user, client)) return null;
  return client;
}

export async function createClientWithTimeline(input: {
  actorId: string;
  name: string;
  companyName: string;
  email?: string | null;
  phone?: string | null;
  ownerId?: string | null;
  teamId?: string | null;
  startDate: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const stages = await tx.stage.findMany({ where: { active: true }, orderBy: { position: "asc" } });
    if (stages.length === 0) throw new Error("No active stages configured");

    const client = await tx.client.create({
      data: {
        name: input.name,
        companyName: input.companyName,
        email: input.email,
        phone: input.phone,
        ownerId: input.ownerId,
        teamId: input.teamId,
        startDate: input.startDate,
      },
    });

    const planned = buildPlannedTimeline(stages, input.startDate);
    const createdStages = [];

    for (const item of planned) {
      createdStages.push(
        await tx.clientStage.create({
          data: {
            clientId: client.id,
            stageId: item.stageId,
            position: item.position,
            plannedStartDate: item.plannedStartDate,
            plannedEndDate: item.plannedEndDate,
            actualStartDate: item.position === stages[0].position ? input.startDate : null,
            status: item.position === stages[0].position ? ClientStageStatus.ACTIVE : ClientStageStatus.NOT_STARTED,
            durationDaysSnapshot: item.durationDaysSnapshot,
          },
        }),
      );
    }

    await tx.client.update({
      where: { id: client.id },
      data: { currentClientStageId: createdStages[0].id },
    });

    const templates = await tx.taskTemplate.findMany({ where: { active: true }, orderBy: [{ stage: { position: "asc" } }, { sortOrder: "asc" }] });
    for (const template of templates) {
      const clientStage = createdStages.find((stage) => stage.stageId === template.stageId);
      if (!clientStage) continue;
      await tx.task.create({
        data: {
          clientId: client.id,
          clientStageId: clientStage.id,
          title: template.title,
          description: template.description,
          priority: template.priority,
          assignedUserId: template.defaultAssignedUserId ?? input.ownerId,
          assignedTeamId: template.defaultAssignedTeamId ?? input.teamId,
          startDate: new Date(clientStage.plannedStartDate.getTime() + template.startOffsetDays * 24 * 60 * 60 * 1000),
          dueDate: new Date(clientStage.plannedStartDate.getTime() + template.dueOffsetDays * 24 * 60 * 60 * 1000),
          estimatedDurationDays: template.estimatedDurationDays,
          blocksPhaseCompletion: template.blocksPhaseCompletion,
          sortOrder: template.sortOrder,
          createdById: input.actorId,
        },
      });
    }

    await tx.activityLog.create({
      data: {
        actorId: input.actorId,
        action: "CLIENT_CREATED",
        entityType: EntityType.CLIENT,
        entityId: client.id,
        clientId: client.id,
        metadata: { startDate: input.startDate.toISOString() },
      },
    });

    return client;
  });
}

export async function advanceClientStage(input: { actorId: string; clientId: string; targetClientStageId?: string; confirmPendingTasks?: boolean }) {
  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: input.clientId },
      include: {
        currentClientStage: { include: { stage: true, tasks: { where: { archivedAt: null } } } },
        stages: { include: { stage: true }, orderBy: { position: "asc" } },
      },
    });

    if (!client || !client.currentClientStage) throw new Error("Client or active stage not found");
    if (client.status === ClientStatus.COMPLETED) throw new Error("Client is already completed");

    const current = client.currentClientStage;
    const next =
      input.targetClientStageId
        ? client.stages.find((stage) => stage.id === input.targetClientStageId)
        : client.stages.find((stage) => stage.position === current.position + 1);

    const blocking = current.tasks.filter((task) => task.blocksPhaseCompletion && task.status !== TaskStatus.COMPLETED);
    if (blocking.length > 0 && !input.confirmPendingTasks) {
      return { needsConfirmation: true, pendingCount: blocking.length, clientId: client.id };
    }

    const now = new Date();

    await tx.clientStage.update({
      where: { id: current.id },
      data: { status: ClientStageStatus.COMPLETED, actualEndDate: now, completedAt: now },
    });

    // Approval starts Vinculación and Entrevistas together. Both are gates for
    // the kick off; the current pointer moves through the open parallel work.
    if (current.position === 1) {
      const parallel = client.stages.filter((stage) => stage.stage.parallelGroup === "inicio");
      await Promise.all(parallel.map((stage) => tx.clientStage.update({ where: { id: stage.id }, data: { status: ClientStageStatus.ACTIVE, actualStartDate: now } })));
      await tx.client.update({ where: { id: client.id }, data: { currentClientStageId: parallel[0]?.id } });
      return { advanced: true, clientId: client.id };
    }

    if (current.stage.parallelGroup === "inicio") {
      const counterpart = client.stages.find((stage) => stage.id !== current.id && stage.stage.parallelGroup === "inicio");
      if (counterpart?.status !== ClientStageStatus.COMPLETED) {
        await tx.client.update({ where: { id: client.id }, data: { currentClientStageId: counterpart?.id } });
        return { advanced: true, clientId: client.id };
      }
      const kickoff = client.stages.find((stage) => stage.position === 4);
      if (kickoff) {
        await tx.clientStage.update({ where: { id: kickoff.id }, data: { status: ClientStageStatus.ACTIVE, actualStartDate: now, plannedStartDate: now, plannedEndDate: new Date(now.getTime() + kickoff.durationDaysSnapshot * 86_400_000) } });
        await tx.client.update({ where: { id: client.id }, data: { currentClientStageId: kickoff.id } });
        return { advanced: true, clientId: client.id };
      }
    }

    // The next production phase is planned from the real close of this one.
    // This preserves the traffic team's single source of truth when a delivery slips.
    if (next && next.position === current.position + 1) {
      const newStart = now;
      const newEnd = new Date(newStart.getTime() + next.durationDaysSnapshot * 24 * 60 * 60 * 1000);
      const oldStart = next.plannedStartDate;
      await tx.clientStage.update({ where: { id: next.id }, data: { plannedStartDate: newStart, plannedEndDate: newEnd } });
      const taskRows = await tx.task.findMany({ where: { clientStageId: next.id, archivedAt: null } });
      for (const task of taskRows) {
        await tx.task.update({
          where: { id: task.id },
          data: {
            startDate: task.startDate ? new Date(task.startDate.getTime() + newStart.getTime() - oldStart.getTime()) : null,
            dueDate: task.dueDate ? new Date(task.dueDate.getTime() + newStart.getTime() - oldStart.getTime()) : null,
          },
        });
      }
    }

    if (!next) {
      await tx.client.update({
        where: { id: client.id },
        data: { status: ClientStatus.COMPLETED },
      });
      await tx.activityLog.create({
        data: {
          actorId: input.actorId,
          action: "CLIENT_COMPLETED",
          entityType: EntityType.CLIENT,
          entityId: client.id,
          clientId: client.id,
          clientStageId: current.id,
        },
      });
      return { completed: true, clientId: client.id };
    }

    if (next.position !== current.position + 1) {
      throw new Error("Only sequential stage movement is allowed in the MVP");
    }

    await tx.clientStage.update({
      where: { id: next.id },
      data: { status: ClientStageStatus.ACTIVE, actualStartDate: now },
    });

    await tx.client.update({
      where: { id: client.id },
      data: { currentClientStageId: next.id },
    });

    await tx.activityLog.create({
      data: {
        actorId: input.actorId,
        action: "CLIENT_STAGE_ADVANCED",
        entityType: EntityType.CLIENT,
        entityId: client.id,
        clientId: client.id,
        clientStageId: next.id,
        previousValue: { stage: current.stage.name },
        newValue: { stage: next.stage.name },
      },
    });

    return { advanced: true, clientId: client.id };
  });

  revalidatePath("/clients");
  revalidatePath(`/clients/${input.clientId}`);
  revalidatePath("/dashboard");
  return result;
}
