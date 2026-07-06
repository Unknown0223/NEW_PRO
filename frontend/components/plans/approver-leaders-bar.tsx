"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { filterSelectOptions, usedLeaderExcludeIds } from "./approver-used-options";
import { SearchableSelect } from "./searchable-select";
import type { ApproverPerson } from "./approvers-api";
import type { EditableRow } from "./approver-table";

type Props = {
  leaders: number[];
  rows: EditableRow[];
  options: ApproverPerson[];
  canWrite: boolean;
  nameOf: (id: number) => string;
  onReorder: (next: number[]) => void;
  onChange: (index: number, nextId: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  canAdd: boolean;
};

function LeaderChip({
  id,
  index,
  leaders,
  rows,
  options,
  canWrite,
  nameOf,
  onChange,
  onRemove
}: {
  id: number;
  index: number;
  leaders: number[];
  rows: EditableRow[];
  options: ApproverPerson[];
  canWrite: boolean;
  nameOf: (id: number) => string;
  onChange: (index: number, nextId: number) => void;
  onRemove: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `leader-${id}-${index}`
  });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const chipOptions = filterSelectOptions(options, id, usedLeaderExcludeIds(leaders, rows, index));
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 pr-1 shadow-sm"
    >
      <div className="w-[230px]">
        <SearchableSelect
          value={id}
          options={chipOptions}
          onChange={(next) => onChange(index, next)}
          nameOf={nameOf}
          disabled={!canWrite}
          menuWidth={280}
          triggerClassName="border-transparent bg-transparent font-medium text-foreground hover:bg-accent"
        />
      </div>
      {canWrite && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          title="Перетащите для изменения порядка"
        >
          <GripVertical className="size-3.5" />
        </button>
      )}
      {canWrite && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute -right-2 -top-2 z-10 flex size-[18px] items-center justify-center rounded-full border border-red-300 bg-background text-red-500 shadow-sm hover:bg-red-50"
          title="Удалить"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}

export function ApproverLeadersBar({
  leaders,
  rows,
  options,
  canWrite,
  nameOf,
  onReorder,
  onChange,
  onRemove,
  onAdd,
  canAdd
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = leaders.map((id, i) => `leader-${id}-${i}`);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(leaders, from, to));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={leaders.map((id, i) => `leader-${id}-${i}`)}
          strategy={horizontalListSortingStrategy}
        >
          {leaders.map((id, index) => (
            <LeaderChip
              key={`leader-${id}-${index}`}
              id={id}
              index={index}
              leaders={leaders}
              rows={rows}
              options={options}
              canWrite={canWrite}
              nameOf={nameOf}
              onChange={onChange}
              onRemove={onRemove}
            />
          ))}
        </SortableContext>
      </DndContext>
      {canWrite && canAdd && (
        <button
          type="button"
          onClick={onAdd}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-dashed border-teal-500/60 bg-card px-4 py-2.5",
            "text-xs font-medium text-teal-600 transition-colors hover:bg-teal-50 dark:hover:bg-teal-500/10"
          )}
        >
          <Plus className="size-4" /> Добавить главный утверждающий
        </button>
      )}
    </div>
  );
}
