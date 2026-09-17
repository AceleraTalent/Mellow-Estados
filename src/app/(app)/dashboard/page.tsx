import Link from "next/link";
import { ClientStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getClientList } from "@/server/services/clients";
import { formatDate } from "@/server/domain/dates";
import { HealthBadge, Progress } from "@/components/badges";

export default async function DashboardPage() {
  const user = await requireUser();
  const clients = await getClientList(user);
  const tasksPending = await prisma.task.count({ where: { archivedAt: null, status: { not: TaskStatus.COMPLETED } } });
  const tasksOverdue = await prisma.task.count({ where: { archivedAt: null, status: { not: TaskStatus.COMPLETED }, dueDate: { lt: new Date() } } });
  const activeClients = clients.filter((client) => client.status === ClientStatus.ACTIVE);
  const delayed = clients.filter((client) => client.health === "Delayed");
  const dueSoon = clients.filter((client) => client.health === "Due soon");
  const recent = await prisma.activityLog.findMany({
    include: { actor: true, client: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Operational status across active clients and tasks.</p>
        </div>
      </div>

      <section className="grid metrics dashboard-metrics">
        <Link className="panel metric metric-link" href="/clients"><span className="muted">Active clients</span><strong>{activeClients.length}</strong><small>View active portfolio →</small></Link>
        <Link className="panel metric metric-link" href="/clients?health=On%20track"><span className="muted">On track</span><strong>{clients.filter((c) => c.health === "On track").length}</strong><small>Projects moving well →</small></Link>
        <Link className="panel metric metric-link metric-danger" href="/clients?health=Delayed"><span className="muted">Delayed</span><strong>{delayed.length}</strong><small>Needs a decision →</small></Link>
        <Link className="panel metric metric-link" href="/tasks"><span className="muted">Pending tasks</span><strong>{tasksPending}</strong><small>Review task queue →</small></Link>
        <Link className="panel metric metric-link metric-danger" href="/tasks?view=overdue"><span className="muted">Overdue tasks</span><strong>{tasksOverdue}</strong><small>Resolve overdue work →</small></Link>
      </section>

      <section className="two-col" style={{ marginTop: 16 }}>
        <div className="panel panel-pad">
          <h3>Needs attention</h3>
          <div className="grid">
            {[...delayed, ...dueSoon].slice(0, 8).map((client) => (
              <Link href={`/clients/${client.id}`} key={client.id} className="attention-card">
                <div><strong>{client.name}</strong><strong>{client.clientProgress}%</strong></div>
                <p>{client.stage?.name ?? "No active stage"}</p>
                <Progress value={client.clientProgress} />
                <div className="attention-meta"><HealthBadge value={client.health} /><span>Deadline {formatDate(client.deadline)}</span></div>
                <small>{client.timing.dayLabel} in stage · View client →</small>
              </Link>
            ))}
            {delayed.length + dueSoon.length === 0 ? <p className="muted">No clients need attention today.</p> : null}
          </div>
        </div>
        <div className="panel panel-pad">
          <h3>Recent activity</h3>
          <div className="grid">
            {recent.map((item) => (
              <div key={item.id}>
                <strong>{item.actor?.name ?? "System"}</strong>
                <p className="muted" style={{ margin: "4px 0" }}>
                  {item.action.replaceAll("_", " ").toLowerCase()} {item.client ? `· ${item.client.name}` : ""} · {formatDate(item.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
