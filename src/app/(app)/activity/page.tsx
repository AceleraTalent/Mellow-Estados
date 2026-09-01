import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { formatDate } from "@/server/domain/dates";

export default async function ActivityPage() {
  await requireUser();
  const activity = await prisma.activityLog.findMany({
    include: { actor: true, client: true, task: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Activity</h2>
          <p>Traceable history for client and task changes.</p>
        </div>
      </div>
      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Client</th>
              <th>Task</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((item) => (
              <tr key={item.id}>
                <td>{formatDate(item.createdAt)}</td>
                <td>{item.actor?.name ?? "System"}</td>
                <td>{item.action.replaceAll("_", " ").toLowerCase()}</td>
                <td>{item.client?.name ?? "-"}</td>
                <td>{item.task?.title ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
