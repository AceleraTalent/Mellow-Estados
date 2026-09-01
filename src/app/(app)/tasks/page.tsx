import { TaskPriority, TaskStatus } from "@prisma/client";
import { requireUser } from "@/server/auth";
import { getTaskList } from "@/server/services/tasks";
import { formatDate } from "@/server/domain/dates";
import { PriorityBadge, TaskStatusBadge } from "@/components/badges";
import { updateTaskStatusAction } from "@/app/actions";
import { TaskBoard } from "@/components/tasks/task-board";

export default async function TasksPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const user = await requireUser();
  const tasks = await getTaskList(user, params);
  const view = params.view ?? "all";

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Tasks</h2>
          <p>Cross-client work list with persisted status changes.</p>
        </div>
      </div>

      <form className="toolbar">
        <select className="select" name="view" defaultValue={view}>
          <option value="all">All tasks</option>
          <option value="my">My tasks</option>
          <option value="overdue">Overdue</option>
          <option value="due-soon">Due soon</option>
          <option value="completed">Completed</option>
        </select>
        <input className="input" name="q" placeholder="Search task or client" defaultValue={params.q ?? ""} />
        <select className="select" name="status" defaultValue={params.status ?? ""}>
          <option value="">All statuses</option>
          {Object.values(TaskStatus).map((status) => <option key={status}>{status}</option>)}
        </select>
        <select className="select" name="priority" defaultValue={params.priority ?? ""}>
          <option value="">All priorities</option>
          {Object.values(TaskPriority).map((priority) => <option key={priority}>{priority}</option>)}
        </select>
        <button className="button secondary" type="submit">Apply</button>
      </form>

      <section className="panel table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Client</th>
              <th>Stage</th>
              <th>Status</th>
              <th>Responsible</th>
              <th>Team</th>
              <th>Priority</th>
              <th>Due</th>
              <th>Update</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td><strong>{task.title}</strong><br /><span className="muted">{task.description}</span></td>
                <td>{task.client.name}</td>
                <td>{task.clientStage.stage.name}</td>
                <td><TaskStatusBadge value={task.status} /></td>
                <td>{task.assignedUser?.name ?? "-"}</td>
                <td>{task.assignedTeam?.name ?? "-"}</td>
                <td><PriorityBadge value={task.priority} /></td>
                <td>{formatDate(task.dueDate)}</td>
                <td>
                  <form action={async () => {
                    "use server";
                    await updateTaskStatusAction(task.id, task.status === TaskStatus.COMPLETED ? TaskStatus.PENDING : TaskStatus.COMPLETED);
                  }}>
                    <button className="button secondary" type="submit">{task.status === TaskStatus.COMPLETED ? "Reopen" : "Complete"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginTop: 18 }}>
        <div className="page-header">
          <div>
            <h2 style={{ fontSize: 20 }}>Task board</h2>
            <p>Drag tasks between statuses. Changes persist to PostgreSQL.</p>
          </div>
        </div>
        <TaskBoard
          tasks={tasks.map((task) => ({
            id: task.id,
            title: task.title,
            client: task.client.name,
            stage: task.clientStage.stage.name,
            status: task.status,
            due: formatDate(task.dueDate),
          }))}
        />
      </section>
    </>
  );
}
