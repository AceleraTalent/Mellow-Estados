import { EntityType, Prisma } from "@prisma/client";
import { prisma } from "./db";

export async function logActivity(input: {
  actorId?: string | null;
  action: string;
  entityType: EntityType;
  entityId: string;
  clientId?: string | null;
  clientStageId?: string | null;
  taskId?: string | null;
  previousValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
}) {
  return prisma.activityLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      clientId: input.clientId,
      clientStageId: input.clientStageId,
      taskId: input.taskId,
      previousValue: input.previousValue ?? undefined,
      newValue: input.newValue ?? undefined,
      metadata: input.metadata ?? undefined,
    },
  });
}
