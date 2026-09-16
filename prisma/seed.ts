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
    prisma.team.create({ data: { name: "Operaciones", description: "Vinculación y coordinación de proyectos" } }),
    prisma.team.create({ data: { name: "Diseño", description: "Diseño y artes finales" } }),
    prisma.team.create({ data: { name: "Comercial", description: "Relación comercial con clientes" } }),
  ]);

  const passwordHash = await bcrypt.hash("mellow123", 12);

  const [admin, carlos, victor, yudi, isabel, lina] = await Promise.all([
    prisma.user.create({
      data: { name: "Admin Mellow", email: "admin@mellow.local", passwordHash, role: UserRole.ADMIN, teamId: operations.id },
    }),
    prisma.user.create({
      data: { name: "Carlos", email: "carlos@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: commercial.id },
    }),
    prisma.user.create({
      data: { name: "Víctor", email: "victor@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: design.id },
    }),
    prisma.user.create({
      data: { name: "Yudi", email: "yudi@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: operations.id },
    }),
    prisma.user.create({
      data: { name: "Isabel", email: "isabel@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: operations.id },
    }),
    prisma.user.create({
      data: { name: "Lina", email: "lina@mellow.local", passwordHash, role: UserRole.MEMBER, teamId: commercial.id },
    }),
  ]);

  const stageData = [
    {
      name: "Comercial",
      description: "Credenciales, propuesta de precio y aprobación del cliente",
      position: 1,
      defaultDurationDays: 5,
    },
    { name: "Vinculación", description: "Documentos y primera factura", position: 2, defaultDurationDays: 10, parallelGroup: "inicio" },
    { name: "Entrevistas", description: "Entrevistas de todos los participantes del cliente", position: 3, defaultDurationDays: 14, parallelGroup: "inicio" },
    { name: "Kick off", description: "Taller de propuesta de valor", position: 4, defaultDurationDays: 1 },
    { name: "Landscape", description: "Mapeo competitivo y hallazgos", position: 5, defaultDurationDays: 14 },
    { name: "Estrategia", description: "Posicionamiento y estrategia de marca", position: 6, defaultDurationDays: 14 },
    { name: "Diseño", description: "Exploración y sistema visual", position: 7, defaultDurationDays: 14 },
    { name: "Artes finales", description: "Aplicaciones, control de calidad y entrega", position: 8, defaultDurationDays: 10 },
  ];

  const stages: Stage[] = [];
  for (const item of stageData) {
    stages.push(await prisma.stage.create({ data: item }));
  }

  const templates = [
    ["Presentación de credenciales", "Comercial", commercial.id, 0, 1, false], ["Propuesta de precio", "Comercial", commercial.id, 2, 3, false], ["Cliente da el OK", "Comercial", commercial.id, 4, 4, true],
    ["Envío de documentos", "Vinculación", operations.id, 0, 6, false], ["Primera factura", "Vinculación", operations.id, 7, 9, true],
    ["Envío de link", "Entrevistas", commercial.id, 0, 0, false], ["Todos los participantes responden", "Entrevistas", commercial.id, 1, 13, true],
    ["Taller de propuesta de valor", "Kick off", commercial.id, 0, 0, true],
    ["Investigación secundaria / benchmark", "Landscape", operations.id, 0, 2, false], ["Análisis de competencia", "Landscape", operations.id, 3, 4, false], ["Entrevistas internas adicionales", "Landscape", operations.id, 5, 6, false], ["Documento de hallazgos", "Landscape", operations.id, 7, 10, true], ["Presentación a cliente", "Landscape", operations.id, 11, 13, true],
    ["Posicionamiento y territorio de marca", "Estrategia", commercial.id, 0, 2, false], ["Arquetipos / buyer personas", "Estrategia", commercial.id, 3, 4, false], ["Mensajes clave", "Estrategia", commercial.id, 5, 6, false], ["Documento de estrategia", "Estrategia", commercial.id, 7, 10, true], ["Presentación a cliente", "Estrategia", commercial.id, 11, 13, true],
    ["Moodboard / exploración visual", "Diseño", design.id, 0, 2, false], ["Primeras propuestas", "Diseño", design.id, 3, 6, false], ["Revisión interna", "Diseño", design.id, 7, 7, false], ["Presentación de propuestas al cliente", "Diseño", design.id, 8, 8, true], ["Ronda de ajustes", "Diseño", design.id, 9, 13, true],
    ["Aplicaciones de marca según alcance", "Artes finales", design.id, 0, 6, false], ["Control de calidad / consistencia", "Artes finales", design.id, 7, 8, true], ["Entrega de archivos finales al cliente", "Artes finales", design.id, 9, 9, true],
  ] as const;

  for (const [index, template] of templates.entries()) {
      const [title, stageName, teamId, startOffsetDays, dueOffsetDays, blocksPhaseCompletion] = template;
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
        estimatedDurationDays: dueOffsetDays - startOffsetDays + 1,
        blocksPhaseCompletion,
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
          estimatedDurationDays: template.estimatedDurationDays,
          blocksPhaseCompletion: template.blocksPhaseCompletion,
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

  await createClient({ name: "Acme Corp", companyName: "Acme Corp", startDate: date("2026-08-21"), activePosition: 1, ownerId: carlos.id, teamId: commercial.id });
  await createClient({ name: "Nova Retail", companyName: "Nova Retail", startDate: date("2026-07-22"), activePosition: 5, ownerId: isabel.id, teamId: operations.id });
  await createClient({ name: "Andes Studio", companyName: "Andes Studio", startDate: date("2026-07-01"), activePosition: 5, ownerId: isabel.id, teamId: operations.id, delayed: true });
  await createClient({ name: "Lima Foods", companyName: "Lima Foods", startDate: date("2026-06-15"), activePosition: 6, ownerId: lina.id, teamId: commercial.id });
  await createClient({ name: "Cali Health", companyName: "Cali Health", startDate: date("2026-05-28"), activePosition: 7, ownerId: victor.id, teamId: design.id });
  await createClient({ name: "Bogota Legal", companyName: "Bogota Legal", startDate: date("2026-05-01"), activePosition: 8, ownerId: yudi.id, teamId: operations.id, completed: true });

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
