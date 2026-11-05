import { useState } from "react";
import { Alert, Anchor, Group, Loader, Menu, Text } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { changeDocumentIcon, deleteDocument, getDocument, renameDocument } from "../api/documents";
import { listSpaces } from "../api/spaces";
import { useCurrentUser } from "../user/currentUser";
import { useMarkDocumentRead } from "../notifications/useMarkDocumentRead";
import { ChildPages } from "./ChildPages";
import { CopyLinkMenuItem } from "./CopyLinkMenuItem";
import { DeletePageModal } from "./DeletePageModal";
import { ExportModal } from "./export/ExportModal";
import { HistoryModal } from "./history/HistoryModal";
import { pageIcon } from "./pageIcon";
import { PageView } from "./PageView";

// 경로의 아이콘과 제목 사이 간격을 띄워 표시 (아이콘이 없으면 기본 아이콘)
function IconLabel({ icon, title }: { icon: string | null | undefined; title: string }) {
  return (
    <>
      <span aria-hidden style={{ marginRight: 6 }}>{pageIcon(icon)}</span>
      {title}
    </>
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// 프로젝트 아래 하위 페이지 화면
export function DocumentPage() {
  const documentId = Number(useParams().documentId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);

  // 경로 맨 앞 프로젝트 아이콘 (사이드바와 같은 캐시 사용)
  const { data: spaces } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });

  const { data: doc, error, isPending } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => getDocument(documentId),
    enabled: Number.isInteger(documentId),
  });
  // 열어 본 페이지는 수정 알림에서 제외
  useMarkDocumentRead(Number.isInteger(documentId) ? documentId : null);

  const rename = useMutation({
    mutationFn: (next: string) => renameDocument(documentId, next),
    onSuccess: (detail) => {
      queryClient.setQueryData(["document", documentId], detail);
      queryClient.invalidateQueries({ queryKey: ["documents", detail.spaceId] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });

  // 아이콘은 사이드바, 하위 페이지 목록, 검색 결과에도 보이므로 함께 갱신
  const changeIcon = useMutation({
    mutationFn: (icon: string | null) => changeDocumentIcon(documentId, icon),
    onSuccess: (detail) => {
      queryClient.setQueryData(["document", documentId], detail);
      queryClient.invalidateQueries({ queryKey: ["documents", detail.spaceId] });
      queryClient.invalidateQueries({ queryKey: ["document"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteDocument(documentId),
    onSuccess: () => {
      const spaceId = doc?.spaceId;
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.removeQueries({ queryKey: ["document", documentId] });
      setConfirmDelete(false);
      // 삭제 후 상위 페이지(없으면 프로젝트)로 이동
      const parentId = doc?.parentId;
      navigate(parentId ? `/documents/${parentId}` : spaceId ? `/spaces/${spaceId}` : "/work-status");
    },
  });

  if (!Number.isInteger(documentId) || (error instanceof ApiError && error.status === 404)) {
    return <Alert color="gray">삭제되었거나 없는 페이지입니다</Alert>;
  }
  if (error) {
    return <Alert color="red">{errorMessage(error, "페이지를 불러오지 못했습니다.")}</Alert>;
  }
  if (isPending || !doc || !user) {
    return <Loader size="sm" />;
  }
  // 최상위 페이지 본문(검색 결과 등으로 들어온 경우)은 최상위 페이지 화면으로
  if (doc.home) {
    return <Navigate to={`/spaces/${doc.spaceId}`} replace />;
  }
  // 파일 항목 주소로 들어오면 미리보기 화면으로
  if (doc.kind === "FILE") {
    return <Navigate to={`/files/${doc.id}`} replace />;
  }

  const spaceIcon = spaces?.find((space) => space.id === doc.spaceId)?.icon;

  return (
    <>
      <PageView
        doc={doc}
        user={user}
        breadcrumb={
          <Group gap={8} wrap="nowrap">
            <Anchor component={Link} to={`/spaces/${doc.spaceId}`} size="sm" c="dimmed" truncate>
              <IconLabel icon={spaceIcon} title={doc.spaceName ?? "페이지"} />
            </Anchor>
            {/* 상위 페이지 경로 */}
            {doc.path.map((ancestor) => (
              <Group key={ancestor.id} gap={8} wrap="nowrap">
                <Text size="sm" c="dimmed">/</Text>
                <Anchor component={Link} to={`/documents/${ancestor.id}`} size="sm" c="dimmed" truncate>
                  <IconLabel icon={ancestor.icon} title={ancestor.title} />
                </Anchor>
              </Group>
            ))}
            <Text size="sm" c="dimmed">/</Text>
            <Text size="sm" truncate><IconLabel icon={doc.icon} title={doc.title} /></Text>
          </Group>
        }
        menuItems={
          <>
            <CopyLinkMenuItem path={`/documents/${doc.id}`} />
            <Menu.Item onClick={() => setExporting(true)}>내보내기</Menu.Item>
            <Menu.Item onClick={() => setShowingHistory(true)}>수정 이력</Menu.Item>
            <Menu.Item color="red" onClick={() => setConfirmDelete(true)}>페이지 삭제</Menu.Item>
          </>
        }
        onRename={(title) => rename.mutate(title)}
        renameError={
          rename.error ? errorMessage(rename.error, "제목을 저장하지 못했습니다.")
            : changeIcon.error ? errorMessage(changeIcon.error, "아이콘을 저장하지 못했습니다.")
              : null
        }
        onChangeIcon={(icon) => changeIcon.mutate(icon)}
        footer={<ChildPages spaceId={doc.spaceId} parentId={doc.id} />}
      />
      <ExportModal opened={exporting} documentId={doc.id} title={doc.title} onClose={() => setExporting(false)} />
      <HistoryModal opened={showingHistory} documentId={doc.id} title={doc.title} onClose={() => setShowingHistory(false)} />
      <DeletePageModal
        opened={confirmDelete}
        title={doc.title}
        pending={remove.isPending}
        error={remove.error ? errorMessage(remove.error, "페이지를 삭제하지 못했습니다.") : null}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
