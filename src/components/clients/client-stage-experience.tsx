"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { setCurrentClientStageAction } from "@/app/actions";
import { HealthBadge, Progress, TaskStatusBadge } from "@/components/badges";
import { TaskCompleteCheckbox } from "@/components/tasks/task-complete-checkbox";

type Stage = {
  id: string;
  position: number;
  status: string;
  actualStartDate: Date | null;
  tasks: { id: string; title: string; description: string | null; status: "PENDING" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED"; archivedAt: Date | null }[];
  stage: { name: string };
};

export function ClientStageExperience({ clientId, stages, currentStageId, health, progress }: { clientId: string; stages: Stage[]; currentStageId?: string | null; health: string; progress: number }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(currentStageId ?? stages[0]?.id);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState("");
  const ordered = useMemo(() => [...stages].sort((a, b) => a.position - b.position), [stages]);
  const selected = ordered.find((stage) => stage.id === selectedId) ?? ordered[0];
  const currentIndex = ordered.findIndex((stage) => stage.id === currentStageId);
  const selectedIndex = ordered.findIndex((stage) => stage.id === selected?.id);
  const tasks = selected?.tasks.filter((task) => !task.archivedAt) ?? [];
  const done = tasks.filter((task) => task.status === "COMPLETED").length;
  const stageProgress = tasks.length ? Math.round((done / tasks.length) * 100) : selected?.status === "COMPLETED" ? 100 : 0;

  function setCurrent() {
    if (!selected || selected.id === currentStageId) return;
    if (selectedIndex > currentIndex && !confirming) { setConfirming(true); return; }
    startTransition(async () => {
      try {
        const result = await setCurrentClientStageAction(clientId, selected.id);
        setNotice(`Client moved to ${result.stageName}`);
        setConfirming(false);
        router.refresh();
      } catch {
        setNotice("The stage could not be updated. Please try again.");
      }
    });
  }

  return (
    <section className="client-stage-experience">
      {notice ? <div className="toast" role="status">{notice}</div> : null}
      <div className="client-progress-head">
        <div><span className="eyebrow">Project status</span><HealthBadge value={health} /></div>
        <div className="overall-number"><strong>{progress}%</strong><span>Overall progress</span></div>
      </div>
      <Progress value={progress} variant="large" />

      <div className="stage-stepper" aria-label="Project stages">
        {ordered.map((stage, index) => {
          const isCurrent = stage.id === currentStageId;
          const isComplete = index < currentIndex || stage.status === "COMPLETED";
          const isSelected = stage.id === selected?.id;
          return <button type="button" className={`step ${isCurrent ? "current" : ""} ${isComplete ? "complete" : ""} ${isSelected ? "selected" : ""}`} key={stage.id} onClick={() => { setSelectedId(stage.id); setConfirming(false); }}>
            <span className="step-line" aria-hidden="true" />
            <span className="step-dot">{isComplete ? <Check size={14} strokeWidth={3} /> : isCurrent ? <Circle size={9} fill="currentColor" /> : null}</span>
            <span className="step-name">{stage.stage.name}</span>
            {isCurrent ? <span className="current-label">Current</span> : null}
          </button>;
        })}
      </div>

      {selected ? <div className="selected-stage-panel">
        <div className="selected-stage-head">
          <div><span className="eyebrow">{selected.id === currentStageId ? "Current stage" : "Selected stage"}</span><h3>{selected.stage.name}</h3></div>
          {selected.id !== currentStageId ? <div className="stage-action">
            {confirming ? <p>Move client to {selected.stage.name}?</p> : null}
            <div><button className="button secondary" type="button" onClick={() => setConfirming(false)} hidden={!confirming}>Cancel</button><button className="button warning" type="button" disabled={pending} onClick={setCurrent}>{pending ? <Loader2 className="spin" size={16} /> : null}{confirming ? "Move client" : "Set as current stage"}</button></div>
          </div> : null}
        </div>
        <div className="stage-progress-row"><div><span className="eyebrow">Progress</span><strong>{done} / {tasks.length} tasks completed</strong></div><Progress value={stageProgress} /></div>
        <div className="selected-task-list">
          {tasks.map((task) => <div className="selected-task" key={task.id}><TaskCompleteCheckbox taskId={task.id} status={task.status} /><div><strong>{task.title}</strong>{task.description ? <span>{task.description}</span> : null}</div><TaskStatusBadge value={task.status} /></div>)}
          {!tasks.length ? <p className="muted">No tasks have been added to this stage yet.</p> : null}
        </div>
      </div> : null}
    </section>
  );
}
