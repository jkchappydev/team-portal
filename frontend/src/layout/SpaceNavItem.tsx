import { useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { ActionIcon, Box, Menu, NavLink, Tooltip } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NavLink as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { itemIdOfPath } from "../documents/itemPath";
import { pathAfterSpaceDeleted } from "../documents/spaceNavigation";
import { ApiError } from "../api/client";
import type { DocumentDetailDto } from "../api/documents";
import { deleteSpace } from "../api/spaces";
import type { SpaceDto } from "../api/spaces";
import { CopyLinkMenuItem } from "../documents/CopyLinkMenuItem";
import { DeleteSpaceModal } from "../documents/DeleteSpaceModal";
import { ExportModal } from "../documents/export/ExportModal";
import { ImportModal } from "../documents/import/ImportModal";
import { HistoryModal } from "../documents/history/HistoryModal";
import { PageIcon } from "../documents/PageIconView";
import { spaceLabel } from "../documents/spaceKind";
import type { DropPosition } from "./dropPosition";
import { isNewItem } from "./reorderAnimation";

// 사이드바에서 끌고 있는 프로젝트 (프로젝트 목록 영역이 놓을 위치를 계산)
let draggingSpaceId: number | null = null;

export function draggingSpace(): number | null {
  return draggingSpaceId;
}

const DRAG_TYPE = "application/x-portal-space";

// 링크 이동 없이 버튼 동작만 실행
function stopLink(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

// 프로젝트를 휴지통으로 보내고, 그 프로젝트나 소속 페이지를 보고 있었으면 사이드바 옆 프로젝트로 이동
function useDeleteSpace(space: SpaceDto, onDeleted: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteSpace(space.id),
    onSuccess: () => {
      // 목록을 다시 불러오기 전에 지운 프로젝트의 위치로 다음 화면을 정함
      const nextPath = pathAfterSpaceDeleted(queryClient.getQueryData<SpaceDto[]>(["spaces"]), space.id);
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      onDeleted();
      const pageId = itemIdOfPath(location.pathname);
      const viewingPage = pageId !== null
        && queryClient.getQueryData<DocumentDetailDto>(["document", pageId])?.spaceId === space.id;
      if (location.pathname === `/spaces/${space.id}` || viewingPage) {
        navigate(nextPath);
      }
    },
  });
}

interface SpaceNavItemProps {
  space: SpaceDto;
  // 끌어서 프로젝트 순서를 바꿀 수 있는지
  reorderable?: boolean;
  // 프로젝트 목록이 정한 이 줄의 가로선
  dropLine?: DropPosition | null;
}

// 사이드바 프로젝트 한 줄: 아이콘 + 이름, 마우스를 올리면 ⋯ 메뉴 (프로젝트 안 페이지는 본문 /페이지 블록으로 들어감)
export function SpaceNavItem({ space, reorderable = false, dropLine = null }: SpaceNavItemProps) {
  const [hovered, setHovered] = useState(false);
  // ⋯ 메뉴가 열려 있는 동안은 마우스가 벗어나도 버튼 유지
  const [menuOpened, setMenuOpened] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);
  // 제목이 칸을 넘어 말줄임(…)으로 잘렸을 때만 마우스를 올리면 전체 제목 표시
  const [truncated, setTruncated] = useState(false);
  // 방금 만든 프로젝트면 처음 나타날 때 잠깐 강조
  const [isNew] = useState(() => isNewItem(`space-${space.id}`));
  const remove = useDeleteSpace(space, () => setConfirmDelete(false));

  return (
    <>
      <Box>
        <NavLink
          component={RouterLink}
          to={`/spaces/${space.id}`}
          label={
            <Tooltip label={space.name} disabled={!truncated} openDelay={500} withArrow position="right" multiline maw={320}>
              <span
                onMouseEnter={(e) => {
                  const body = e.currentTarget.closest(".mantine-NavLink-body");
                  setTruncated(!!body && body.scrollWidth > body.clientWidth);
                }}
              >
                {space.name}
              </span>
            </Tooltip>
          }
          noWrap
          py={4}
          pl={6}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onKeyDown={(e) => {
            if (e.key !== "Delete") return;
            e.preventDefault();
            setConfirmDelete(true);
          }}
          draggable={reorderable}
          data-flip-id={`space-${space.id}`}
          data-new={isNew || undefined}
          data-space-row
          data-drop-position={dropLine ?? undefined}
          onDragStart={(e: DragEvent<HTMLAnchorElement>) => {
            if (!reorderable) return;
            // 브라우저가 링크에 자동으로 싣는 주소를 지워 Edge "분할 화면에서 열기"나 본문 링크 삽입이 뜨지 않게 함
            e.dataTransfer.clearData();
            e.dataTransfer.setData(DRAG_TYPE, space.name);
            e.dataTransfer.effectAllowed = "move";
            draggingSpaceId = space.id;
          }}
          onDragEnd={() => {
            draggingSpaceId = null;
          }}
          leftSection={
            <Box className="tree-slot" w={22} h={22}>
              <span aria-hidden className="tree-slot-icon"><PageIcon icon={space.icon} project={space.kind === "PROJECT"} /></span>
            </Box>
          }
          rightSection={hovered || menuOpened ? (
            <Menu position="bottom-start" withinPortal opened={menuOpened} onChange={setMenuOpened}>
              <Tooltip label="삭제 등" withArrow openDelay={300} disabled={menuOpened}>
                <Menu.Target>
                  <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`${space.name} 메뉴`} onClick={stopLink}>
                    ⋯
                  </ActionIcon>
                </Menu.Target>
              </Tooltip>
              {/* 포털 안의 클릭이 React 트리를 따라 링크로 전달되지 않도록 차단 */}
              <Menu.Dropdown onClick={stopLink}>
                <CopyLinkMenuItem path={`/spaces/${space.id}`} />
                {space.homeDocumentId !== null && (
                  <Menu.Item onClick={() => setExporting(true)}>내보내기</Menu.Item>
                )}
                {space.homeDocumentId !== null && (
                  <Menu.Item onClick={() => setImporting(true)}>가져오기</Menu.Item>
                )}
                {space.homeDocumentId !== null && (
                  <Menu.Item onClick={() => setShowingHistory(true)}>수정 이력</Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => setConfirmDelete(true)}>{spaceLabel(space.kind)} 삭제</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : null}
          styles={{ section: { marginInlineEnd: 6 } }}
        />
      </Box>
      {/* 링크 밖에 두어 확인 창 안의 클릭이 프로젝트 이동으로 이어지지 않게 함 */}
      {space.homeDocumentId !== null && (
        <ImportModal
          opened={importing}
          target={{ spaceId: space.id, documentId: space.homeDocumentId, title: space.name, icon: null, applyTitle: false }}
          onClose={() => setImporting(false)}
        />
      )}
      {space.homeDocumentId !== null && (
        <ExportModal opened={exporting} documentId={space.homeDocumentId} title={space.name} onClose={() => setExporting(false)} />
      )}
      {space.homeDocumentId !== null && (
        <HistoryModal opened={showingHistory} documentId={space.homeDocumentId} title={space.name}
          onClose={() => setShowingHistory(false)} />
      )}
      <DeleteSpaceModal
        opened={confirmDelete}
        name={space.name}
        kind={space.kind}
        pending={remove.isPending}
        error={remove.error ? (remove.error instanceof ApiError ? remove.error.message : `${spaceLabel(space.kind)}를 삭제하지 못했습니다.`) : null}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
