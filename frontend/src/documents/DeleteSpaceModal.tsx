import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import type { SpaceKind } from "../api/spaces";
import { spaceLabel } from "./spaceKind";

interface Props {
  opened: boolean;
  name: string;
  // 프로젝트·최상위 페이지에 따라 문구를 바꿈
  kind: SpaceKind;
  pending: boolean;
  // 삭제 실패 메시지 (없으면 미표시)
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// 프로젝트 화면과 사이드바에서 함께 쓰는 최상위 항목(프로젝트·페이지) 삭제 확인 창
export function DeleteSpaceModal({ opened, name, kind, pending, error, onClose, onConfirm }: Props) {
  const label = spaceLabel(kind);
  return (
    <Modal opened={opened} onClose={onClose} title={`${label} 삭제`} centered>
      <Stack>
        <Text size="sm">"{name}" {label}를 삭제할까요? 본문과 안의 페이지도 함께 휴지통으로 가며 복원할 수 있습니다.</Text>
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
