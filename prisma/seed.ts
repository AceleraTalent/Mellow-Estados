import { PrismaClient, Stage, TaskPriority, TaskStatus, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const day = 24 * 60 * 60 * 1000;

function date(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * day);
}

async function main() {
  await prisma.activityLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.taskTemplate.deleteMany();
  await prisma.client.updateMany({ data: { currentClientStageId: null } });
  await prisma.clientStage.deleteMany();
  await prisma.client.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.stage.deleteMany();
  await prisma.team.deleteMany();

  const [operations, design, commercial] = await Promise.all([
    prisma.team.create({ data: { name: "Operations", description: "Delivery and client operations" } }),
    prisma.team.create({ data: { name: "Design", description: "Creative and asset preparation" } }),
    prisma.team.create({ data: { name: "Commercial", description: "Client-facing commercial work" } }),
  ]);

  const passwordHash = await bcrypt.hash("mellow123", 12);

  const [admin, laura, juan, sofia, camila] = await Promise.all([
    prisma.user.create({
      data: { name: "Admin Mellow", email: "admin@mellow.local", passwordHash, role: UserRole.ADMIN, teamId: operations.id },
    }),
    prisma.user.create({
      data: { name: "Laura Perez", email: "laura@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: operations.id },
    }),
    prisma.user.create({
      data: { name: "Juan Rojas", email: "juan@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: design.id },
    }),
    prisma.user.create({
      data: { name: "Sofia Marin", email: "sofia@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: commercial.id },
    }),
    prisma.user.create({
      data: { name: "Camila Torres", email: "camila@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: operations.id },
    }),
  ]);

  const stageData = [
    {
      name: "Entrevistas & Propuesta de Valor",
      description: "Entrevistas iniciales y definicion de propuesta de valor",
      position: 1,
      defaultDurationDays: 14,
    },
    { name: "Landscape", description: "Mapeo competitivo, referentes y oportunidades de posicionamiento", position: 2, defaultDurationDays: 30 },
    { name: "Brand Strategy", description: "Estrategia de marca, narrativa, arquitectura y direccion creativa", position: 3, defaultDurationDays: 30 },
    { name: "Brand Design", description: "Sistema visual, aplicaciones de marca y entrega final", position: 4, defaultDurationDays: 21 },
  ];

  const stages: Stage[] = [];
  for (const item of stageData) {
    stages.push(await prisma.stage.create({ data: item }));
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

  async function createClient(input: {
    name: string;
    companyName: string;
    startDate: Date;
    activePosition: number;
    ownerId: string;
    teamId: string;
    completed?: boolean;
    delayed?: boolean;
  }) {
    const client = await prisma.client.create({
      data: {
        name: input.name,
        companyName: input.companyName,
        email: `${input.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        phone: "+57 300 000 0000",
        status: input.completed ? "COMPLETED" : "ACTIVE",
        ownerId: input.ownerId,
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
          assignedUserId: input.ownerId,
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
        metadata: { source: "seed" },
      },
    });

    return client;
  }

  await createClient({ name: "Acme Corp", companyName: "Acme Corp", startDate: date("2026-08-21"), activePosition: 1, ownerId: laura.id, teamId: operations.id });
  await createClient({ name: "Nova Retail", companyName: "Nova Retail", startDate: date("2026-07-22"), activePosition: 2, ownerId: camila.id, teamId: operations.id });
  await createClient({ name: "Andes Studio", companyName: "Andes Studio", startDate: date("2026-07-01"), activePosition: 2, ownerId: juan.id, teamId: design.id, delayed: true });
  await createClient({ name: "Lima Foods", companyName: "Lima Foods", startDate: date("2026-06-15"), activePosition: 3, ownerId: sofia.id, teamId: commercial.id });
  await createClient({ name: "Cali Health", companyName: "Cali Health", startDate: date("2026-05-28"), activePosition: 4, ownerId: laura.id, teamId: operations.id });
  await createClient({ name: "Bogota Legal", companyName: "Bogota Legal", startDate: date("2026-05-01"), activePosition: 4, ownerId: camila.id, teamId: operations.id, completed: true });

  console.log("Seed complete. Login with admin@mellow.local / mellow123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
