import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { getActiveStages } from "@/server/services/stages";
import { getClientList } from "@/server/services/clients";
import { formatDate } from "@/server/domain/dates";
import { HealthBadge, Progress } from "@/components/badges";
import { createClientAction } from "@/app/actions";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const user = await requireUser();
  const [clients, stages, users, teams] = await Promise.all([
    getClientList(user, params),
    getActiveStages(),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Clients</h2>
          <p>Primary operational view for every active client.</p>
        </div>
        <Link className="button secondary" href="/clients/board">Board view</Link>
      </div>

      <form className="toolbar">
        <input className="input" name="q" placeholder="Search client, company, owner" defaultValue={params.q ?? ""} />
        <select className="select" name="stageId" defaultValue={params.stageId ?? ""}>
          <option value="">All stages</option>
          {stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}
        </select>
        <select className="select" name="health" defaultValue={params.health ?? ""}>
          <option value="">All health</option>
          <option>Delayed</option>
          <option>Due soon</option>
          <option>On track</option>
          <option>Completed</option>
        </select>
        <select className="select" name="sort" defaultValue={params.sort ?? ""}>
          <option value="">Attention first</option>
          <option value="deadline">Stage deadline</option>
          <option value="days">Days in stage</option>
          <option value="progress">Overall progress</option>
          <option value="name">Client name</option>
        </select>
        <button className="button secondary" type="submit">Apply</button>
      </form>

      <section className="client-card-grid">
        {clients.map((client) => (
          <Link href={`/clients/${client.id}`} className="client-list-card" key={client.id}>
            <div className="client-card-title"><div><strong>{client.name}</strong><span>{client.companyName}</span></div><strong>{client.clientProgress}%</strong></div>
            <p>{client.stage?.name ?? "No active stage"}</p>
            <Progress value={client.clientProgress} />
            <div className="client-card-footer"><span>{client.stageProgress}% of current stage</span><span>{client.openTasks} open tasks</span></div>
            <div className="client-card-meta"><HealthBadge value={client.health} /><span>Deadline {formatDate(client.deadline)}</span></div>
          </Link>
        ))}
        {!clients.length ? <div className="panel panel-pad muted">No clients match these filters.</div> : null}
      </section>

      <section className="panel panel-pad" style={{ marginTop: 16 }}>
        <h3>Create client</h3>
        <form action={createClientAction} className="form-grid">
          <input className="input" name="name" placeholder="Client name" required />
          <input className="input" name="companyName" placeholder="Company" required />
          <input className="input" name="email" type="email" placeholder="Email" />
          <input className="input" name="phone" placeholder="Phone" />
          <select className="select" name="ownerId" defaultValue="">
            <option value="">Owner</option>
            {users.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
          </select>
          <select className="select" name="teamId" defaultValue="">
            <option value="">Team</option>
            {teams.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
          </select>
          <input className="input" name="startDate" type="date" required />
          <button className="button" type="submit"><Plus size={16} /> Create client and timeline</button>
        </form>
      </section>
    </>
  );
}
