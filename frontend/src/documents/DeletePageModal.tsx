import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { DocumentKind } from "../api/documents";

interface Props {
  opened: boolean;
  title: string;
  // 파일·WBS 항목 삭제면 하위 페이지 안내 없이 종류에 맞는 문구로 표시
  kind?: DocumentKind;
  pending: boolean;
  // 삭제 실패 메시지 (없으면 미표시)
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

const LABELS: Record<DocumentKind, string> = { PAGE: "페이지", FILE: "파일", WBS: "WBS" };

// 페이지 화면과 사이드바에서 함께 쓰는 페이지·파일·WBS 삭제 확인 창
export function DeletePageModal({ opened, title, kind = "PAGE", pending, error, onClose, onConfirm }: Props) {
  const label = LABELS[kind];
  return (
    <Modal opened={opened} onClose={onClose} title={`${label} 삭제`} centered>
      <Stack>
        <Text size="sm">
          {kind === "PAGE"
            ? `"${title}" 페이지를 삭제할까요? 하위 페이지도 함께 숨겨지며, 휴지통에서 복원하면 같이 돌아옵니다.`
            : `"${title}" ${label}${kind === "WBS" ? "를" : "을"} 삭제할까요? 휴지통에서 복원할 수 있습니다.`}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          {/* 창이 열리면 삭제 버튼에 포커스가 있어 Enter로 바로 삭제 */}
          <Button color="red" loading={pending} onClick={onConfirm} data-autofocus>삭제</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
