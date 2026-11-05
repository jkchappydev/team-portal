import { useState } from "react";
import { Alert, Button, Group, Modal, Select, Stack, Text } from "@mantine/core";
import { useCurrentUser } from "../../user/currentUser";
import { EXPORT_FORMATS, exportDocument } from "./exportDocument";
import type { ExportFormat } from "./exportDocument";

interface Props {
  opened: boolean;
  // 내보낼 페이지 본문 문서와 파일 이름에 쓸 제목
  documentId: number;
  title: string;
  onClose: () => void;
}

// 노션처럼 내보내기 형식을 골라 바로 파일로 내려받는 창
export function ExportModal({ opened, documentId, title, onClose }: Props) {
  const { user } = useCurrentUser();
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!user) return;
    setPending(true);
    setError(null);
    try {
      await exportDocument({ documentId, title, format, userId: user.id });
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "내보내지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="내보내기" centered size="sm">
      <Stack>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" c="dimmed">내보내기 형식</Text>
          <Select
            aria-label="내보내기 형식"
            size="xs"
            w={130}
            allowDeselect={false}
            data={EXPORT_FORMATS.map((f) => ({ value: f.value, label: f.label }))}
            value={format}
            onChange={(value) => value && setFormat(value as ExportFormat)}
            comboboxProps={{ withinPortal: true }}
          />
        </Group>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button loading={pending} disabled={!user} onClick={run}>내보내기</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
