import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";

interface Props {
  opened: boolean;
  name: string;
  pending: boolean;
  // 삭제 실패 메시지 (없으면 미표시)
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// 프로젝트 화면과 사이드바에서 함께 쓰는 프로젝트 삭제 확인 창
export function DeleteSpaceModal({ opened, name, pending, error, onClose, onConfirm }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="페이지 삭제" centered>
      <Stack>
        <Text size="sm">"{name}" 페이지를 삭제할까요? 본문과 하위 페이지도 함께 휴지통으로 가며 복원할 수 있습니다.</Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button color="red" loading={pending} onClick={onConfirm}>삭제</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
