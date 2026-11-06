import { useState } from "react";
import { Alert, Loader, Menu } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import { changeDocumentIcon, getDocument, renameDocument } from "../api/documents";
import { deleteSpace, listSpaces } from "../api/spaces";
import type { SpaceDto } from "../api/spaces";
import { pathAfterSpaceDeleted } from "./spaceNavigation";
import { useCurrentUser } from "../user/currentUser";
import { useMarkDocumentRead } from "../notifications/useMarkDocumentRead";
import { ChildPages } from "./ChildPages";
import { CopyLinkMenuItem } from "./CopyLinkMenuItem";
import { DeleteSpaceModal } from "./DeleteSpaceModal";
import { ExportModal } from "./export/ExportModal";
import { HistoryModal } from "./history/HistoryModal";
import { PageView } from "./PageView";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// 프로젝트 화면: 프로젝트 본문 페이지를 노션처럼 바로 편집하고 아래에 하위 페이지 목록
export function SpacePage() {
  const spaceId = Number(useParams().spaceId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);

  const { data: spaces, isPending: spacesPending, error: spacesError } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });
  const space = spaces?.find((s) => s.id === spaceId);
  const homeId = space?.homeDocumentId ?? null;

  const { data: home, error: homeError } = useQuery({
    queryKey: ["document", homeId],
    queryFn: () => getDocument(homeId as number),
    enabled: homeId !== null,
  });
  // 열어 본 페이지는 수정 알림에서 제외
  useMarkDocumentRead(homeId);

  // 본문 제목 변경은 서버에서 프로젝트 이름에도 반영됨
  const rename = useMutation({
    mutationFn: (next: string) => renameDocument(homeId as number, next),
    onSuccess: (detail) => {
      queryClient.setQueryData(["document", homeId], detail);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });

  // 본문 페이지 아이콘이 곧 프로젝트 아이콘이므로 사이드바 프로젝트 목록도 갱신
  const changeIcon = useMutation({
    mutationFn: (icon: string | null) => changeDocumentIcon(homeId as number, icon),
    onSuccess: (detail) => {
      queryClient.setQueryData(["document", homeId], detail);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
    },
  });

  // 프로젝트 삭제 후 사이드바 옆 최상위 페이지(없으면 근무 상황표)로 이동, 사이드바·휴지통 목록 갱신
  const remove = useMutation({
    mutationFn: () => deleteSpace(spaceId),
    onSuccess: () => {
      const nextPath = pathAfterSpaceDeleted(queryClient.getQueryData<SpaceDto[]>(["spaces"]), spaceId);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      setConfirmDelete(false);
      navigate(nextPath);
    },
  });

  if (spacesError) {
    return <Alert color="red">페이지 정보를 불러오지 못했습니다.</Alert>;
  }
  if (!spacesPending && !space) {
    return <Alert color="gray">삭제되었거나 없는 페이지입니다.</Alert>;
  }
  if (homeError) {
    return <Alert color="red">{errorMessage(homeError, "페이지 본문을 불러오지 못했습니다.")}</Alert>;
  }
  if (!space || !home || !user) {
    return <Loader size="sm" />;
  }

  return (
    <>
      <PageView
        doc={home}
        user={user}
        menuItems={
          <>
            <CopyLinkMenuItem path={`/spaces/${spaceId}`} />
            <Menu.Item onClick={() => setExporting(true)}>내보내기</Menu.Item>
            <Menu.Item onClick={() => setShowingHistory(true)}>수정 이력</Menu.Item>
            <Menu.Item color="red" onClick={() => setConfirmDelete(true)}>페이지 삭제</Menu.Item>
          </>
        }
        onRename={(title) => rename.mutate(title)}
        renameError={
          rename.error ? errorMessage(rename.error, "페이지 이름을 저장하지 못했습니다.")
            : changeIcon.error ? errorMessage(changeIcon.error, "아이콘을 저장하지 못했습니다.")
              : null
        }
        onChangeIcon={(icon) => changeIcon.mutate(icon)}
        footer={<ChildPages spaceId={spaceId} parentId={null} />}
      />
      <ExportModal opened={exporting} documentId={home.id} title={space.name} onClose={() => setExporting(false)} />
      <HistoryModal opened={showingHistory} documentId={home.id} title={space.name} onClose={() => setShowingHistory(false)} />
      <DeleteSpaceModal
        opened={confirmDelete}
        name={space.name}
        pending={remove.isPending}
        error={remove.error ? errorMessage(remove.error, "페이지를 삭제하지 못했습니다.") : null}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
