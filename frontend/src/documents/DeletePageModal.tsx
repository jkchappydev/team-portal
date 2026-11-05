import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";

interface Props {
  opened: boolean;
  title: string;
  // 파일 항목 삭제면 하위 페이지 안내 없이 파일 문구로 표시
  file?: boolean;
  pending: boolean;
  // 삭제 실패 메시지 (없으면 미표시)
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

// 페이지 화면과 사이드바에서 함께 쓰는 페이지·파일 삭제 확인 창
export function DeletePageModal({ opened, title, file = false, pending, error, onClose, onConfirm }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title={file ? "파일 삭제" : "페이지 삭제"} centered>
      <Stack>
        <Text size="sm">
          {file
            ? `"${title}" 파일을 삭제할까요? 휴지통에서 복원할 수 있습니다.`
            : `"${title}" 페이지를 삭제할까요? 하위 페이지도 함께 숨겨지며, 휴지통에서 복원하면 같이 돌아옵니다.`}
        </Text>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button color="red" loading={pending} onClick={onConfirm}>삭제</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
