import { Avatar, Tooltip } from "@mantine/core";
import type { Viewer } from "./presence";
import { shortName } from "./presence";

// 한 번에 보여 줄 최대 인원 (나머지는 +N으로 묶음)
const MAX_VISIBLE = 5;

// 구글 문서처럼 지금 이 페이지를 보고 있는 사람(나 포함)을 동그라미로 표시
export function PresenceAvatars({ viewers, selfMemberId }: { viewers: Viewer[]; selfMemberId: number }) {
  if (viewers.length === 0) return null;
  const visible = viewers.slice(0, MAX_VISIBLE);
  const hidden = viewers.slice(MAX_VISIBLE);

  return (
    <Tooltip.Group openDelay={200} closeDelay={100}>
      <Avatar.Group spacing={6} aria-label="지금 보고 있는 사람">
        {visible.map((viewer) => (
          <Tooltip key={viewer.memberId} label={viewer.memberId === selfMemberId ? `${viewer.name} (나)` : `${viewer.name} 님이 보고 있음`} withArrow>
            <Avatar
              size={28}
              radius="xl"
              src={viewer.imageUrl}
              aria-label={viewer.name}
              styles={{
                root: { border: "2px solid var(--mantine-color-body)" },
                placeholder: { background: viewer.color, color: "white", fontSize: 11, fontWeight: 600 },
              }}
            >
              {shortName(viewer.name)}
            </Avatar>
          </Tooltip>
        ))}
        {hidden.length > 0 && (
          <Tooltip label={hidden.map((viewer) => viewer.name).join(", ")} withArrow>
            <Avatar size={28} radius="xl" styles={{ placeholder: { fontSize: 11 } }}>+{hidden.length}</Avatar>
          </Tooltip>
        )}
      </Avatar.Group>
    </Tooltip.Group>
  );
}
