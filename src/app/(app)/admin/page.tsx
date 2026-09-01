import { TaskPriority, UserRole } from "@prisma/client";
import { requireAdmin } from "@/server/auth";
import { prisma } from "@/server/db";
import { createTaskTemplateAction, createUserAction, updateStageAction } from "@/app/admin-actions";

export default async function AdminPage() {
  await requireAdmin();
  const [users, teams, stages, templates] = await Promise.all([
    prisma.user.findMany({ include: { team: true }, orderBy: { name: "asc" } }),
    prisma.team.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stage.findMany({ orderBy: { position: "asc" } }),
    prisma.taskTemplate.findMany({ include: { stage: true, defaultAssignedTeam: true }, orderBy: [{ stage: { position: "asc" } }, { sortOrder: "asc" }] }),
  ]);

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Administration</h2>
          <p>Users, stage definitions, durations, and task templates.</p>
        </div>
      </div>

      <section className="two-col">
        <div className="panel panel-pad">
          <h3>Users</h3>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Team</th></tr></thead>
              <tbody>
                {users.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.email}</td><td>{item.role}</td><td>{item.team?.name ?? "-"}</td></tr>)}
              </tbody>
            </table>
          </div>
          <form action={createUserAction} className="form-grid" style={{ marginTop: 14 }}>
            <input className="input" name="name" placeholder="Name" required />
            <input className="input" name="email" type="email" placeholder="Email" required />
            <input className="input" name="password" placeholder="Password" defaultValue="mellow123" />
            <select className="select" name="role" defaultValue={UserRole.MEMBER}>
              {Object.values(UserRole).map((role) => <option key={role}>{role}</option>)}
            </select>
            <select className="select" name="teamId" defaultValue="">
              <option value="">Team</option>
              {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button className="button" type="submit">Create user</button>
          </form>
        </div>

        <div className="panel panel-pad">
          <h3>Stages</h3>
          <div className="grid">
            {stages.map((stage) => (
              <form action={updateStageAction} className="grid panel panel-pad" key={stage.id}>
                <input type="hidden" name="id" value={stage.id} />
                <strong>Position {stage.position}</strong>
                <input className="input" name="name" defaultValue={stage.name} />
                <input className="input" name="description" defaultValue={stage.description ?? ""} />
                <input className="input" name="defaultDurationDays" type="number" min={1} defaultValue={stage.defaultDurationDays} />
                <label style={{ display: "flex", gap: 8 }}><input type="checkbox" name="active" defaultChecked={stage.active} /> Active</label>
                <button className="button secondary" type="submit">Save stage</button>
              </form>
            ))}
          </div>
        </div>
      </section>

      <section className="panel panel-pad" style={{ marginTop: 16 }}>
        <h3>Task templates</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Stage</th><th>Task</th><th>Priority</th><th>Team</th><th>Offsets</th></tr></thead>
            <tbody>
              {templates.map((item) => (
                <tr key={item.id}>
                  <td>{item.stage.name}</td>
                  <td>{item.title}</td>
                  <td>{item.priority}</td>
                  <td>{item.defaultAssignedTeam?.name ?? "-"}</td>
                  <td>{item.startOffsetDays} / {item.dueOffsetDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form action={createTaskTemplateAction} className="form-grid" style={{ marginTop: 14 }}>
          <select className="select" name="stageId" required>
            {stages.map((stage) => <option value={stage.id} key={stage.id}>{stage.name}</option>)}
          </select>
          <input className="input" name="title" placeholder="Template task title" required />
          <input className="input" name="description" placeholder="Description" />
          <select className="select" name="priority" defaultValue={TaskPriority.MEDIUM}>
            {Object.values(TaskPriority).map((priority) => <option key={priority}>{priority}</option>)}
          </select>
          <select className="select" name="defaultAssignedTeamId" defaultValue="">
            <option value="">Default team</option>
            {teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
          </select>
          <input className="input" name="startOffsetDays" type="number" defaultValue={0} />
          <input className="input" name="dueOffsetDays" type="number" defaultValue={3} />
          <input className="input" name="sortOrder" type="number" defaultValue={0} />
          <button className="button" type="submit">Create template</button>
        </form>
      </section>
    </>
  );
}
