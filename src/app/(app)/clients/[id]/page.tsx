import Link from "next/link";
import { notFound } from "next/navigation";
import { TaskPriority } from "@prisma/client";
import { ArrowRight, Plus } from "lucide-react";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { getClientDetail } from "@/server/services/clients";
import { formatDate } from "@/server/domain/dates";
import { getStageHealth, getStageTiming } from "@/server/domain/health";
import { taskCounts } from "@/server/domain/progress";
import { HealthBadge, PriorityBadge, Progress, TaskStatusBadge } from "@/components/badges";
import { TaskCompleteCheckbox } from "@/components/tasks/task-complete-checkbox";
import { advanceClientAction, createTaskAction } from "@/app/actions";

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClientDetail(id, user);
  if (!client) notFound();

  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const teams = await prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const current = client.currentClientStage;
  const currentCounts = taskCounts(current?.tasks ?? []);
  const clientCounts = taskCounts(client.tasks);
  const currentTiming = current
    ? getStageTiming({
        actualStartDate: current.actualStartDate,
        plannedStartDate: current.plannedStartDate,
        plannedEndDate: current.plannedEndDate,
        durationDays: current.durationDaysSnapshot,
      })
    : null;
  const health = getStageHealth({ clientStatus: client.status, stageStatus: current?.status, plannedEndDate: current?.plannedEndDate });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>{client.name}</h2>
          <p>{client.companyName} · {client.owner?.name ?? "No owner"} · {client.team?.name ?? "No team"}</p>
        </div>
        <Link className="button secondary" href="/clients">Back to clients</Link>
      </div>

      <section className="grid metrics">
        <div className="panel metric"><span className="muted">Started</span><strong style={{ fontSize: 18 }}>{formatDate(client.startDate)}</strong></div>
        <div className="panel metric"><span className="muted">Expected completion</span><strong style={{ fontSize: 18 }}>{formatDate(client.stages.at(-1)?.plannedEndDate)}</strong></div>
        <div className="panel metric"><span className="muted">Current stage</span><strong style={{ fontSize: 18 }}>{current?.stage.name ?? "-"}</strong></div>
        <div className="panel metric"><span className="muted">Overall progress</span><strong style={{ fontSize: 18 }}>{clientCounts.progress}%</strong></div>
        <div className="panel metric"><span className="muted">Health</span><strong style={{ fontSize: 18 }}><HealthBadge value={health} /></strong></div>
      </section>

      <section className="panel panel-pad" style={{ marginTop: 16 }}>
        <h3>Timeline</h3>
        <div className="timeline">
          {client.stages.map((clientStage) => {
            const counts = taskCounts(clientStage.tasks);
            const stageHealth = getStageHealth({ clientStatus: client.status, stageStatus: clientStage.status, plannedEndDate: clientStage.plannedEndDate });
            return (
              <div className={`timeline-card ${clientStage.id === current?.id ? "active" : ""}`} key={clientStage.id}>
                <strong>{clientStage.position}. {clientStage.stage.name}</strong>
                <p className="muted">{formatDate(clientStage.plannedStartDate)} - {formatDate(clientStage.plannedEndDate)}</p>
                <p className="muted">Actual: {formatDate(clientStage.actualStartDate)} - {formatDate(clientStage.actualEndDate)}</p>
                <Progress value={counts.progress} />
                <div style={{ marginTop: 8 }}><HealthBadge value={stageHealth} /></div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="two-col" style={{ marginTop: 16 }}>
        <div className="panel panel-pad">
          <h3>Tasks</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Done</th>
                </tr>
              </thead>
              <tbody>
                {client.tasks.map((task) => (
                  <tr key={task.id}>
                    <td><strong>{task.title}</strong><br /><span className="muted">{task.description}</span></td>
                    <td>{task.clientStage.stage.name}</td>
                    <td><TaskStatusBadge value={task.status} /></td>
                    <td><PriorityBadge value={task.priority} /></td>
                    <td>{task.assignedUser?.name ?? task.assignedTeam?.name ?? "-"}</td>
                    <td>{formatDate(task.dueDate)}</td>
                    <td>
                      <TaskCompleteCheckbox taskId={task.id} status={task.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="grid">
          <div className="panel panel-pad">
            <h3>{current?.stage.name ?? "No active stage"}</h3>
            {current && currentTiming ? (
              <>
                <p><strong>{currentTiming.dayLabel}</strong></p>
                <p className="muted">{currentTiming.label}</p>
                <Progress value={currentCounts.progress} />
                <p className="muted">{currentCounts.pending} tasks pending</p>
                <form action={advanceClientAction} className="grid">
                  <input type="hidden" name="clientId" value={client.id} />
                  <label style={{ display: "flex", gap: 8 }}>
                    <input type="checkbox" name="confirmPendingTasks" />
                    Continue even if tasks remain open
                  </label>
                  <button className="button warning" type="submit"><ArrowRight size={16} /> Complete stage</button>
                </form>
              </>
            ) : null}
          </div>

          <div className="panel panel-pad">
            <h3>Create task</h3>
            <form action={createTaskAction} className="grid">
              <input type="hidden" name="clientId" value={client.id} />
              <select className="select" name="clientStageId" defaultValue={current?.id}>
                {client.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.stage.name}</option>)}
              </select>
              <input className="input" name="title" placeholder="Task title" required />
              <textarea className="textarea" name="description" placeholder="Description" />
              <select className="select" name="priority" defaultValue={TaskPriority.MEDIUM}>
                {Object.values(TaskPriority).map((priority) => <option key={priority}>{priority}</option>)}
              </select>
              <select className="select" name="assignedUserId" defaultValue="">
                <option value="">Assigned user</option>
                {users.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <select className="select" name="assignedTeamId" defaultValue="">
                <option value="">Assigned team</option>
                {teams.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
              </select>
              <input className="input" name="dueDate" type="date" />
              <button className="button" type="submit"><Plus size={16} /> Create task</button>
            </form>
          </div>

          <div className="panel panel-pad">
            <h3>Activity</h3>
            <div className="grid">
              {client.activities.map((item) => (
                <div key={item.id}>
                  <strong>{item.action.replaceAll("_", " ").toLowerCase()}</strong>
                  <p className="muted">{item.actor?.name ?? "System"} · {formatDate(item.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}
