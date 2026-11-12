import { useState } from "react";
import { ActionIcon, Tooltip } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addFavorite, FAVORITES_KEY, listFavorites, removeFavorite } from "../api/favorites";

// 별 모양 (채우면 노란 별, 비우면 회색 테두리 별)
// pop: 방금 눌러 추가했을 때 별이 살짝 커졌다 돌아오는 효과
function StarIcon({ filled, pop, onPopEnd }: { filled: boolean; pop: boolean; onPopEnd: () => void }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="favorite-star"
      data-pop={pop || undefined} onAnimationEnd={onPopEnd}
      fill={filled ? "var(--mantine-color-yellow-5)" : "none"}
      stroke={filled ? "var(--mantine-color-yellow-6)" : "currentColor"}
      strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z" />
    </svg>
  );
}

// 페이지 머리의 즐겨찾기 별: 누르면 노란 별로 바뀌고 즐겨찾기 목록 맨 아래에 추가, 다시 누르면 뺌
export function FavoriteButton({ documentId }: { documentId: number }) {
  const queryClient = useQueryClient();
  const { data: favorites = [] } = useQuery({ queryKey: FAVORITES_KEY, queryFn: listFavorites });
  const saved = favorites.some((f) => f.documentId === documentId);
  const [pop, setPop] = useState(false);
  const toggle = useMutation({
    mutationFn: (add: boolean) => (add ? addFavorite(documentId) : removeFavorite(documentId)),
    onSuccess: (list) => queryClient.setQueryData(FAVORITES_KEY, list),
  });
  // 서버 응답을 기다리지 않고 누르자마자 별 모양을 바꿈 (실패하면 원래 모양으로)
  const favorite = toggle.isPending ? toggle.variables : saved;
  const label = favorite ? "즐겨찾기에서 빼기" : "즐겨찾기에 추가";
  return (
    <Tooltip label={label} withArrow>
      <ActionIcon variant="subtle" color="gray" aria-label={label} aria-pressed={favorite}
        onClick={() => {
          if (toggle.isPending) return;
          setPop(!favorite);
          toggle.mutate(!favorite);
        }}>
        <StarIcon filled={favorite} pop={pop} onPopEnd={() => setPop(false)} />
      </ActionIcon>
    </Tooltip>
  );
}
