import { UserRole } from "@prisma/client";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db";
import { createTeamAction } from "@/app/admin-actions";

export default async function TeamsPage() {
  const user = await requireUser();
  const teams = await prisma.team.findMany({ include: { users: true, clients: true, tasks: true }, orderBy: { name: "asc" } });

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Teams</h2>
          <p>Operational ownership across clients and tasks.</p>
        </div>
      </div>
      <section className="grid metrics">
        {teams.map((team) => (
          <div className="panel panel-pad" key={team.id}>
            <strong>{team.name}</strong>
            <p className="muted">{team.description}</p>
            <p>{team.users.length} users · {team.clients.length} clients · {team.tasks.length} tasks</p>
          </div>
        ))}
      </section>
      {user.role === UserRole.ADMIN ? (
        <section className="panel panel-pad" style={{ marginTop: 16 }}>
          <h3>Create team</h3>
          <form action={createTeamAction} className="form-grid">
            <input className="input" name="name" placeholder="Team name" required />
            <input className="input" name="description" placeholder="Description" />
            <button className="button" type="submit">Create team</button>
          </form>
        </section>
      ) : null}
    </>
  );
}
