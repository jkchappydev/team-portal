import { lazy, Suspense, useState } from "react";
import { Alert, Box, Button, Group, Loader, Modal, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "../../api/client";
import { getDocument } from "../../api/documents";
import { PageIcon } from "../PageIconView";

// 일정 표 번들은 블록이 있을 때만 로드
const WbsBoard = lazy(() => import("../../wbs/WbsBoard").then((m) => ({ default: m.WbsBoard })));

// 본문 일정 블록: 제목과 크게 보기 버튼, 그 아래 일정표
// 크게 보기는 페이지를 떠나지 않는 전체 화면 창이라 작게 보기(Esc)로 닫으면 본문 편집을 그대로 이어감
export function ScheduleBlockView({ documentId }: { documentId: number }) {
  const [expanded, setExpanded] = useState(false);
  const { data: doc, error } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: documentId > 0,
  });

  // 연결된 WBS가 휴지통에 있거나 없으면 안내만 표시
  if (documentId <= 0 || (error instanceof ApiError && error.status === 404) || (doc && doc.kind !== "WBS")) {
    return <Alert color="gray" w="100%">삭제되었거나 없는 일정입니다.</Alert>;
  }

  const title = (
    <Text fw={600} size="sm" truncate>
      <span style={{ marginRight: 6 }}><PageIcon icon={doc?.icon ?? "📊"} /></span>
      {doc?.title ?? "일정"}
    </Text>
  );

  return (
    <Box w="100%" py={4} data-testid="schedule-block" contentEditable={false}>
      <Group justify="space-between" mb={6} wrap="nowrap">
        {title}
        <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setExpanded(true)} style={{ flexShrink: 0 }}>
          크게 보기
        </Button>
      </Group>
      {/* 크게 보기 중에는 같은 일정표를 두 번 그리지 않음 */}
      {!expanded && (
        <Suspense fallback={<Loader size="sm" />}>
          <WbsBoard documentId={documentId} />
        </Suspense>
      )}
      <Modal
        opened={expanded}
        onClose={() => setExpanded(false)}
        fullScreen
        withCloseButton={false}
        returnFocus={false}
        transitionProps={{ duration: 0 }}
      >
        <Group justify="space-between" mb="md" wrap="nowrap">
          {title}
          <Button size="compact-sm" variant="light" onClick={() => setExpanded(false)} style={{ flexShrink: 0 }}>
            작게 보기
          </Button>
        </Group>
        <Suspense fallback={<Loader size="sm" />}>
          <WbsBoard documentId={documentId} />
        </Suspense>
      </Modal>
    </Box>
  );
}
