import { TaskStatus } from "@prisma/client";
import { formatDate } from "@/server/domain/dates";

type Stage = {
  id: string;
  position: number;
  plannedStartDate: Date;
  plannedEndDate: Date;
  actualEndDate: Date | null;
  status: string;
  delayReason: string | null;
  stage: { name: string };
  tasks: { id: string; title: string; startDate: Date | null; dueDate: Date | null; status: TaskStatus; blocksPhaseCompletion: boolean; cycle: number | null }[];
};

function day(value: Date) { return Math.floor(value.getTime() / 86_400_000); }

export function TrafficGantt({ stages }: { stages: Stage[] }) {
  const earliest = Math.min(...stages.map((stage) => day(stage.plannedStartDate)));
  const latest = Math.max(...stages.flatMap((stage) => [day(stage.plannedEndDate), ...stage.tasks.map((task) => task.dueDate ? day(task.dueDate) : earliest)]));
  const span = Math.max(1, latest - earliest + 1);
  const place = (start: Date, end: Date) => ({ left: `${((day(start) - earliest) / span) * 100}%`, width: `${Math.max(2, ((day(end) - day(start) + 1) / span) * 100)}%` });

  return (
    <section className="panel panel-pad traffic-panel">
      <div className="traffic-heading"><div><h3>Tráfico del proyecto</h3><p className="muted">Fase en color sólido · tareas internas debajo · <b>▍</b> bloquea el cierre de la fase.</p></div><span className="muted">{formatDate(new Date(earliest * 86_400_000))} — {formatDate(new Date(latest * 86_400_000))}</span></div>
      <div className="traffic-scroll"><div className="traffic-gantt">
        {stages.map((stage) => (
          <div className="traffic-group" key={stage.id}>
            <div className="traffic-row traffic-phase">
              <div className="traffic-label"><strong>{stage.stage.name}</strong><small>{stage.status.replaceAll("_", " ").toLowerCase()}</small></div>
              <div className="traffic-track"><div className={`traffic-bar phase-bar ${stage.status.toLowerCase()}`} style={place(stage.plannedStartDate, stage.plannedEndDate)}>{stage.stage.name}</div></div>
            </div>
            {stage.tasks.map((task) => {
              const start = task.startDate ?? stage.plannedStartDate;
              const end = task.dueDate ?? stage.plannedEndDate;
              return <div className="traffic-row" key={task.id}><div className="traffic-label task-label">{task.blocksPhaseCompletion ? <b className="blocking-mark">▍</b> : null}{task.title}{task.cycle ? ` · Ajuste ${task.cycle}` : null}</div><div className="traffic-track"><div className={`traffic-bar task-bar ${task.status.toLowerCase()} ${task.blocksPhaseCompletion ? "blocking" : ""}`} style={place(start, end)} /></div></div>;
            })}
            {stage.delayReason ? <p className="traffic-delay">Retraso: {stage.delayReason}</p> : null}
          </div>
        ))}
      </div></div>
    </section>
  );
}
