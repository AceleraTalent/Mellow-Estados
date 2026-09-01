import { prisma } from "@/server/db";

export async function getActiveStages() {
  return prisma.stage.findMany({
    where: { active: true },
    orderBy: { position: "asc" },
  });
}
