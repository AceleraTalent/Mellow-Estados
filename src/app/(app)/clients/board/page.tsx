import Link from "next/link";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/server/auth";
import { getClientList } from "@/server/services/clients";
import { getActiveStages } from "@/server/services/stages";
import { ClientBoard } from "@/components/clients/client-board";

export default async function ClientsBoardPage() {
  const user = await requireUser();
  const [clients, stages] = await Promise.all([getClientList(user), getActiveStages()]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Client board</h2>
          <p>Clients grouped by current stage. Stage movement is transactional.</p>
        </div>
        <Link className="button secondary" href="/clients">List view</Link>
      </div>
      <ClientBoard
        canMove={user.role === UserRole.ADMIN}
        stages={stages.map((stage) => ({ id: stage.id, name: stage.name, position: stage.position }))}
        cards={clients.map((client) => ({
          id: client.id,
          name: client.name,
          companyName: client.companyName,
          stageId: client.stage?.id,
          clientStageId: client.currentStage?.id,
          progress: client.clientProgress,
          health: client.health,
          time: client.timing.dayLabel,
          owner: client.owner?.name,
          openTasks: client.openTasks,
        }))}
      />
    </>
  );
}
