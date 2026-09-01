import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const stageId = request.nextUrl.searchParams.get("stageId");
  if (!stageId) return NextResponse.json({ error: "Missing stageId" }, { status: 400 });

  const clientStage = await prisma.clientStage.findFirst({
    where: { clientId: id, stageId },
    select: { id: true },
  });

  return NextResponse.json({ clientStageId: clientStage?.id ?? null });
}
