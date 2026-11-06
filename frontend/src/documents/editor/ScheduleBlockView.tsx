import { lazy, Suspense } from "react";
import { Alert, Anchor, Box, Group, Loader, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { getDocument } from "../../api/documents";
import { PageIcon } from "../PageIconView";

// 일정 표 번들은 블록이 있을 때만 로드
const WbsBoard = lazy(() => import("../../wbs/WbsBoard").then((m) => ({ default: m.WbsBoard })));

// 본문 일정 블록: WBS 제목과 크게 열기 링크, 그 아래 일정표
export function ScheduleBlockView({ documentId }: { documentId: number }) {
  const { data: doc, error } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: documentId > 0,
  });

  // 연결된 WBS가 휴지통에 있거나 없으면 안내만 표시
  if (documentId <= 0 || (error instanceof ApiError && error.status === 404) || (doc && doc.kind !== "WBS")) {
    return <Alert color="gray" w="100%">삭제되었거나 없는 일정입니다.</Alert>;
  }

  return (
    <Box w="100%" py={4} data-testid="schedule-block" contentEditable={false}>
      <Group justify="space-between" mb={6} wrap="nowrap">
        <Text fw={600} size="sm" truncate>
          <span style={{ marginRight: 6 }}><PageIcon icon={doc?.icon ?? "📊"} /></span>
          {doc?.title ?? "일정"}
        </Text>
        <Anchor component={Link} to={`/wbs/${documentId}`} size="xs" c="dimmed" style={{ flexShrink: 0 }}>
          크게 열기
        </Anchor>
      </Group>
      <Suspense fallback={<Loader size="sm" />}>
        <WbsBoard documentId={documentId} />
      </Suspense>
    </Box>
  );
}
