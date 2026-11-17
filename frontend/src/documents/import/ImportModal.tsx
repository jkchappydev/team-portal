import { useState } from "react";
import { Alert, Button, FileInput, Group, List, Modal, Progress, Stack, Text } from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { importNotion } from "./importNotion";
import type { ImportProgress, ImportResult, ImportTarget } from "./importNotion";

interface Props {
  opened: boolean;
  target: ImportTarget;
  onClose: () => void;
}

// 노션에서 HTML로 내보낸 파일을 이 페이지(와 그 아래 페이지)로 가져오는 창
export function ImportModal({ opened, target, onClose }: Props) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (pending) return;
    setFile(null);
    setProgress(null);
    setResult(null);
    setError(null);
    onClose();
  };

  const run = async () => {
    if (!file) return;
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await importNotion(file, target, setProgress));
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "가져오지 못했습니다.");
    } finally {
      setPending(false);
      // 만든 페이지·바뀐 제목을 사이드바·경로·검색에 반영 (실패해도 중간까지 만든 페이지가 보이게)
      void queryClient.invalidateQueries({ queryKey: ["documents", target.spaceId] });
      void queryClient.invalidateQueries({ queryKey: ["spaces"] });
      void queryClient.invalidateQueries({ queryKey: ["document", target.documentId] });
      void queryClient.invalidateQueries({ queryKey: ["search"] });
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="가져오기" centered size="md" closeOnClickOutside={!pending} withCloseButton={!pending}>
      <Stack>
        <Text size="sm" c="dimmed">
          노션에서 HTML 형식으로 내보낸 파일(.zip 또는 .html)을 고르세요. 내용은 이 페이지 본문 뒤에 붙고, 하위 페이지는 이 페이지 아래에 만들어집니다.
        </Text>
        <FileInput
          aria-label="가져올 파일"
          placeholder="파일 선택"
          accept=".zip,.html,application/zip,text/html"
          value={file}
          onChange={setFile}
          disabled={pending || result !== null}
          clearable
        />
        {progress && pending && (
          <Stack gap={4}>
            <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
            <Text size="xs" c="dimmed">{progress.done}/{progress.total} 페이지 · {progress.current}</Text>
          </Stack>
        )}
        {result && (
          <Alert color={result.skipped.length > 0 ? "yellow" : "teal"}>
            <Text size="sm">페이지 {result.pages}개, 파일 {result.files}개를 가져왔습니다.</Text>
            {result.skipped.length > 0 && (
              <>
                <Text size="sm" mt={6}>가져오지 못한 파일 {result.skipped.length}개</Text>
                <List size="xs" mt={4}>
                  {result.skipped.slice(0, 20).map((name) => <List.Item key={name}>{name}</List.Item>)}
                </List>
              </>
            )}
          </Alert>
        )}
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          {result ? (
            <Button onClick={close}>닫기</Button>
          ) : (
            <>
              <Button variant="default" onClick={close} disabled={pending}>취소</Button>
              <Button loading={pending} disabled={!file} onClick={run}>가져오기</Button>
            </>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
