import { Alert, Text } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { getDocument } from "../../api/documents";
import { itemPath } from "../itemPath";
import { PageIcon } from "../PageIconView";

// 본문 페이지 블록: 가리키는 페이지(또는 파일)의 아이콘과 제목 한 줄, 누르면 그 화면으로 이동
// 제목·아이콘은 페이지 화면과 같은 조회를 공유해 바뀌면 바로 반영됨
export function PageBlockView({ documentId }: { documentId: number }) {
  const { data: doc, error } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: documentId > 0,
  });

  // 휴지통에 있거나 없는 문서면 안내만 (블록을 지워도 페이지는 지우지 않으므로 복원하면 다시 보임)
  if (documentId <= 0 || (error instanceof ApiError && error.status === 404)) {
    return <Alert color="gray" w="100%" py={6}>삭제되었거나 없는 페이지입니다.</Alert>;
  }

  if (!doc) {
    return (
      <Text size="sm" c="dimmed" py={4} contentEditable={false}>
        {error ? "페이지를 불러오지 못했습니다." : "불러오는 중…"}
      </Text>
    );
  }

  return (
    <Link to={itemPath(doc.kind, doc.id)} className="page-block" contentEditable={false} draggable={false}>
      <span className="page-block-icon"><PageIcon icon={doc.icon} fallback={doc.kind === "FILE" ? "file" : "page"} /></span>
      <span className="page-block-title">{doc.title}</span>
    </Link>
  );
}
