import { PrismaClient, Stage, TaskPriority, TaskStatus } from "@prisma/client";

const prisma = new PrismaClient();

const day = 24 * 60 * 60 * 1000;

function date(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * day);
}

async function main() {
  const adminUser = await prisma.user.findUnique({ where: { email: "mellow@mellow.local" } });
  if (!adminUser) throw new Error("Admin user mellow@mellow.local not found");
  const admin = adminUser;

  const [operations, design, commercial] = await Promise.all([
    prisma.team.upsert({ where: { name: "Operations" }, update: {}, create: { name: "Operations", description: "Delivery and client operations" } }),
    prisma.team.upsert({ where: { name: "Design" }, update: {}, create: { name: "Design", description: "Creative and asset preparation" } }),
    prisma.team.upsert({ where: { name: "Commercial" }, update: {}, create: { name: "Commercial", description: "Client-facing commercial work" } }),
  ]);

  await prisma.user.update({ where: { id: admin.id }, data: { teamId: operations.id } });

  const stageData = [
    { name: "Entrevistas & Propuesta de Valor", description: "Entrevistas iniciales y definicion de propuesta de valor", position: 1, defaultDurationDays: 14 },
    { name: "Landscape", description: "Mapeo competitivo, referentes y oportunidades de posicionamiento", position: 2, defaultDurationDays: 30 },
    { name: "Brand Strategy", description: "Estrategia de marca, narrativa, arquitectura y direccion creativa", position: 3, defaultDurationDays: 30 },
    { name: "Brand Design", description: "Sistema visual, aplicaciones de marca y entrega final", position: 4, defaultDurationDays: 21 },
  ];

  const stages: Stage[] = [];
  for (const item of stageData) {
    stages.push(await prisma.stage.upsert({ where: { position: item.position }, update: item, create: item }));
  }

  const templates = [
    ["Agendar entrevistas iniciales", "Entrevistas & Propuesta de Valor", operations.id, 0, 3],
    ["Kickoff con cliente", "Entrevistas & Propuesta de Valor", commercial.id, 1, 5],
    ["Sintetizar hallazgos de entrevistas", "Entrevistas & Propuesta de Valor", operations.id, 2, 8],
    ["Definir propuesta de valor", "Entrevistas & Propuesta de Valor", commercial.id, 3, 12],
    ["Mapear competidores directos", "Landscape", operations.id, 0, 10],
    ["Recolectar referentes visuales", "Landscape", design.id, 2, 14],
    ["Identificar territorios de oportunidad", "Landscape", operations.id, 7, 21],
    ["Presentar landscape al cliente", "Landscape", commercial.id, 20, 27],
    ["Construir narrativa estrategica", "Brand Strategy", operations.id, 0, 7],
    ["Definir personalidad y tono", "Brand Strategy", operations.id, 5, 15],
    ["Alinear direccion creativa", "Brand Strategy", design.id, 10, 20],
    ["Aprobar estrategia de marca", "Brand Strategy", commercial.id, 20, 29],
    ["Disenar sistema visual", "Brand Design", design.id, 0, 7],
    ["Preparar aplicaciones de marca", "Brand Design", design.id, 5, 12],
    ["Organizar archivos finales", "Brand Design", operations.id, 8, 15],
    ["Entregar Brand Design al cliente", "Brand Design", commercial.id, 12, 20],
  ] as const;

  const existingTemplates = await prisma.taskTemplate.count();
  if (existingTemplates === 0) {
    for (const [index, template] of templates.entries()) {
      const [title, stageName, teamId, startOffsetDays, dueOffsetDays] = template;
      const stage = stages.find((candidate) => candidate.name === stageName);
      if (!stage) continue;
      await prisma.taskTemplate.create({
        data: {
          stageId: stage.id,
          title,
          priority: index % 5 === 0 ? TaskPriority.HIGH : TaskPriority.MEDIUM,
          defaultAssignedTeamId: teamId,
          startOffsetDays,
          dueOffsetDays,
          sortOrder: index,
        },
      });
    }
  }

  async function createClient(input: {
    name: string;
    companyName: string;
    startDate: Date;
    activePosition: number;
    teamId: string;
    completed?: boolean;
    delayed?: boolean;
  }) {
    const existing = await prisma.client.findFirst({ where: { name: input.name } });
    if (existing) return existing;

    const client = await prisma.client.create({
      data: {
        name: input.name,
        companyName: input.companyName,
        email: `${input.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        phone: "+57 300 000 0000",
        status: input.completed ? "COMPLETED" : "ACTIVE",
        ownerId: admin.id,
        teamId: input.teamId,
        startDate: input.startDate,
      },
    });

    let cursor = input.startDate;
    const clientStages = [];
    for (const stage of stages) {
      const plannedStartDate = cursor;
      const plannedEndDate = addDays(plannedStartDate, stage.defaultDurationDays - 1);
      const status =
        input.completed || stage.position < input.activePosition
          ? "COMPLETED"
          : stage.position === input.activePosition
            ? "ACTIVE"
            : "NOT_STARTED";
      const actualStartDate =
        status === "COMPLETED" || status === "ACTIVE"
          ? input.delayed && stage.position === input.activePosition
            ? addDays(plannedStartDate, -2)
            : plannedStartDate
          : null;
      const actualEndDate = status === "COMPLETED" ? addDays(plannedEndDate, input.delayed ? 3 : -1) : null;
      const clientStage = await prisma.clientStage.create({
        data: {
          clientId: client.id,
          stageId: stage.id,
          position: stage.position,
          plannedStartDate,
          plannedEndDate,
          actualStartDate,
          actualEndDate,
          completedAt: actualEndDate,
          status,
          durationDaysSnapshot: stage.defaultDurationDays,
        },
      });
      clientStages.push(clientStage);
      cursor = addDays(plannedEndDate, 1);
    }

    const current = input.completed
      ? clientStages[clientStages.length - 1]
      : clientStages.find((clientStage) => clientStage.position === input.activePosition);

    await prisma.client.update({
      where: { id: client.id },
      data: { currentClientStageId: current?.id },
    });

    const taskTemplates = await prisma.taskTemplate.findMany({ orderBy: [{ stage: { position: "asc" } }, { sortOrder: "asc" }] });
    for (const template of taskTemplates) {
      const clientStage = clientStages.find((item) => item.stageId === template.stageId);
      if (!clientStage) continue;
      const stageDone = clientStage.status === "COMPLETED";
      const activeStage = clientStage.status === "ACTIVE";
      const status = stageDone
        ? TaskStatus.COMPLETED
        : activeStage && template.sortOrder % 4 === 0
          ? TaskStatus.IN_PROGRESS
          : activeStage && template.sortOrder % 7 === 0
            ? TaskStatus.BLOCKED
            : TaskStatus.PENDING;
      await prisma.task.create({
        data: {
          clientId: client.id,
          clientStageId: clientStage.id,
          title: template.title,
          status,
          priority: template.priority,
          assignedUserId: admin.id,
          assignedTeamId: template.defaultAssignedTeamId ?? input.teamId,
          startDate: addDays(clientStage.plannedStartDate, template.startOffsetDays),
          dueDate: addDays(clientStage.plannedStartDate, template.dueOffsetDays),
          completedAt: status === TaskStatus.COMPLETED ? clientStage.actualEndDate ?? new Date() : null,
          sortOrder: template.sortOrder,
          createdById: admin.id,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        actorId: admin.id,
        action: "CLIENT_CREATED",
        entityType: "CLIENT",
        entityId: client.id,
        clientId: client.id,
        metadata: { source: "seed-demo" },
      },
    });

    return client;
  }

  await createClient({ name: "Acme Corp", companyName: "Acme Corp", startDate: date("2026-08-21"), activePosition: 1, teamId: operations.id });
  await createClient({ name: "Nova Retail", companyName: "Nova Retail", startDate: date("2026-07-01"), activePosition: 3, teamId: design.id, delayed: true });
  await createClient({ name: "Lima Foods", companyName: "Lima Foods", startDate: date("2026-05-01"), activePosition: 4, teamId: commercial.id, completed: true });

  console.log("Demo clients created: Acme Corp, Nova Retail, Lima Foods");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
