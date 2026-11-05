import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { moveMember } from "../api/members";

export function useMemberReorder(ids: number[], enabled: boolean) {
  const [target, setTarget] = useState<{ id: number; after: boolean } | null>(null);
  const dragging = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: ({ id, beforeId }: { id: number; beforeId: number | null }) => moveMember(id, beforeId),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      void queryClient.invalidateQueries({ queryKey: ["annualLeaves"] });
    },
  });
  const start = (event: DragEvent<HTMLElement>, id: number) => {
    if (!enabled || move.isPending) { event.preventDefault(); return; }
    dragging.current = id;
    event.dataTransfer.clearData();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(id));
  };
  const over = (event: DragEvent<HTMLElement>, id: number) => {
    if (!enabled || dragging.current === null) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setTarget({ id, after: event.clientY >= rect.top + rect.height / 2 });
  };
  const drop = (event: DragEvent<HTMLElement>, id: number) => {
    if (!enabled || dragging.current === null) return;
    event.preventDefault();
    const moving = dragging.current;
    const rect = event.currentTarget.getBoundingClientRect();
    const after = event.clientY >= rect.top + rect.height / 2;
    const remaining = ids.filter((value) => value !== moving);
    const at = remaining.indexOf(id);
    if (at >= 0) {
      const beforeId = remaining[at + (after ? 1 : 0)] ?? null;
      if (at + (after ? 1 : 0) !== ids.indexOf(moving)) {
        move.mutate({ id: moving, beforeId });
      }
    }
    dragging.current = null;
    setTarget(null);
  };
  const end = () => { dragging.current = null; setTarget(null); };
  return { start, over, drop, end, target, error: move.error };
}
