import Link from "next/link";
import { ClientStatus, TaskStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth";
import { getClientList } from "@/server/services/clients";
import { formatDate } from "@/server/domain/dates";
import { HealthBadge } from "@/components/badges";

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

      <section className="grid metrics">
        <div className="panel metric"><span className="muted">Active clients</span><strong>{activeClients.length}</strong></div>
        <div className="panel metric"><span className="muted">On track</span><strong>{clients.filter((c) => c.health === "On track").length}</strong></div>
        <div className="panel metric"><span className="muted">Delayed</span><strong>{delayed.length}</strong></div>
        <div className="panel metric"><span className="muted">Pending tasks</span><strong>{tasksPending}</strong></div>
        <div className="panel metric"><span className="muted">Overdue tasks</span><strong>{tasksOverdue}</strong></div>
      </section>

      <section className="two-col" style={{ marginTop: 16 }}>
        <div className="panel panel-pad">
          <h3>Needs attention</h3>
          <div className="grid">
            {[...delayed, ...dueSoon].slice(0, 8).map((client) => (
              <Link href={`/clients/${client.id}`} key={client.id} className="panel panel-pad">
                <strong>{client.name}</strong>
                <p className="muted" style={{ margin: "6px 0" }}>
                  {client.stage?.name} · {client.timing.dayLabel} · deadline {formatDate(client.deadline)}
                </p>
                <HealthBadge value={client.health} />
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
