"use client";

import { useMemo, useTransition } from "react";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import Link from "next/link";
import { advanceClientFromBoard } from "@/app/actions";

type Stage = { id: string; name: string; position: number };
type Card = {
  id: string;
  name: string;
  companyName: string;
  stageId?: string;
  clientStageId?: string;
  progress: number;
  health: string;
  time: string;
  owner?: string;
  openTasks: number;
};

function DraggableCard({ card }: { card: Card }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: card.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div className="board-card" ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Link href={`/clients/${card.id}`}>
        <strong>{card.name}</strong>
        <p className="muted" style={{ margin: "4px 0" }}>{card.companyName}</p>
        <p className="muted" style={{ margin: "8px 0" }}>{card.time} · {card.openTasks} open tasks</p>
        <p className="muted" style={{ margin: 0 }}>{card.progress}% progress · {card.owner ?? "No owner"}</p>
      </Link>
    </div>
  );
}

function Column({ stage, cards }: { stage: Stage; cards: Card[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="board-column" ref={setNodeRef} style={{ outline: isOver ? "2px solid var(--accent)" : undefined }}>
      <strong>{stage.position}. {stage.name}</strong>
      <p className="muted" style={{ margin: "4px 0 8px" }}>{cards.length} clients</p>
      {cards.map((card) => <DraggableCard key={card.id} card={card} />)}
    </div>
  );
}

export function ClientBoard({ stages, cards, canMove }: { stages: Stage[]; cards: Card[]; canMove: boolean }) {
  const [, startTransition] = useTransition();
  const byStage = useMemo(() => {
    return stages.map((stage) => ({
      stage,
      cards: cards.filter((card) => card.stageId === stage.id),
    }));
  }, [cards, stages]);

  function onDragEnd(event: DragEndEvent) {
    const clientId = String(event.active.id);
    const stageId = event.over?.id ? String(event.over.id) : null;
    if (!stageId || !canMove) return;
    const card = cards.find((item) => item.id === clientId);
    if (!card || card.stageId === stageId) return;
    const target = cards.find((item) => item.stageId === stageId && item.clientStageId)?.clientStageId;
    const targetStage = stages.find((stage) => stage.id === stageId);
    const targetClientStageId = card.clientStageId && targetStage ? cards.find((item) => item.id === clientId)?.clientStageId : target;
    const clientTarget = card.clientStageId ? null : targetClientStageId;

    if (!targetStage) return;
    if (!window.confirm(`Move ${card.name} to ${targetStage.name}? Open tasks will be allowed but logged.`)) return;

    startTransition(async () => {
      const response = await fetch(`/api/clients/${clientId}/stage-target?stageId=${stageId}`);
      const data = (await response.json()) as { clientStageId?: string };
      if (data.clientStageId) {
        await advanceClientFromBoard(clientId, data.clientStageId);
      } else if (clientTarget) {
        await advanceClientFromBoard(clientId, clientTarget);
      }
    });
  }

  return (
    <DndContext onDragEnd={onDragEnd}>
      <div className="board">
        {byStage.map(({ stage, cards }) => <Column key={stage.id} stage={stage} cards={cards} />)}
      </div>
    </DndContext>
  );
}
