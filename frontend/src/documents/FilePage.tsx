import { Alert, Anchor, Box, Button, Group, Loader, Text, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { getDocument } from "../api/documents";
import { listSpaces } from "../api/spaces";
import { useMarkDocumentRead } from "../notifications/useMarkDocumentRead";
import { itemPath } from "./itemPath";
import { PageIcon } from "./PageIconView";
import { FilePreview } from "./preview/FilePreview";

// 사이드바에서 파일 항목을 누르면 여는 미리보기 화면 (위에 경로와 다운로드 버튼)
export function FilePage() {
  const documentId = Number(useParams().documentId);
  const { data: spaces } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });
  const { data: doc, error, isPending } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: Number.isInteger(documentId),
  });
  // 열어 본 페이지는 수정 알림에서 제외
  useMarkDocumentRead(Number.isInteger(documentId) ? documentId : null);

  if (!Number.isInteger(documentId) || (error instanceof ApiError && error.status === 404)) {
    return <Alert color="gray">삭제되었거나 없는 파일입니다</Alert>;
  }
  if (error) return <Alert color="red">파일 정보를 불러오지 못했습니다.</Alert>;
  if (isPending || !doc) return <Loader size="sm" />;
  // 페이지·WBS 주소로 들어오면 그 화면으로
  if (doc.kind !== "FILE") return <Navigate to={itemPath(doc.kind, doc.id)} replace />;

  const spaceIcon = spaces?.find((space) => space.id === doc.spaceId)?.icon;

  return (
    <Box maw={1100} mx="auto" px={{ base: "md", sm: 56 }}>
      <Group gap={8} wrap="nowrap" mb="lg">
        <Anchor component={Link} to={`/spaces/${doc.spaceId}`} size="sm" c="dimmed" truncate>
          <span style={{ marginRight: 6 }}><PageIcon icon={spaceIcon} project /></span>{doc.spaceName ?? "페이지"}
        </Anchor>
        {doc.path.map((ancestor) => (
          <Group key={ancestor.id} gap={8} wrap="nowrap">
            <Text size="sm" c="dimmed">/</Text>
            <Anchor component={Link} to={`/documents/${ancestor.id}`} size="sm" c="dimmed" truncate>
              <span style={{ marginRight: 6 }}><PageIcon icon={ancestor.icon} /></span>{ancestor.title}
            </Anchor>
          </Group>
        ))}
      </Group>
      <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
        <Title order={2} style={{ minWidth: 0, wordBreak: "break-all" }}>
          <span style={{ marginRight: 8 }}><PageIcon icon={doc.icon} /></span>{doc.title}
        </Title>
        {doc.fileUrl && (
          <Button component="a" href={doc.fileUrl} download={doc.title} variant="light" style={{ flexShrink: 0 }}>
            다운로드
          </Button>
        )}
      </Group>
      {doc.fileUrl
        ? <FilePreview url={doc.fileUrl} fileName={doc.title} />
        : <Alert color="red">파일 본체를 찾을 수 없습니다.</Alert>}
    </Box>
  );
}
