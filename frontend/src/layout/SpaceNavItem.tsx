import { useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";
import { ActionIcon, Box, Group, Menu, NavLink, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NavLink as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { focusTitleState } from "../documents/titleFocus";
import { itemIdOfPath, itemPath } from "../documents/itemPath";
import { pathAfterSpaceDeleted } from "../documents/spaceNavigation";
import { ApiError } from "../api/client";
import { createDocument, deleteDocument, listDocuments, moveDocument, uploadFileNode } from "../api/documents";
import type { DocumentDetailDto, DocumentSummaryDto } from "../api/documents";
import { deleteSpace } from "../api/spaces";
import type { SpaceDto } from "../api/spaces";
import { CopyLinkMenuItem } from "../documents/CopyLinkMenuItem";
import { DeletePageModal } from "../documents/DeletePageModal";
import { DeleteSpaceModal } from "../documents/DeleteSpaceModal";
import { ExportModal } from "../documents/export/ExportModal";
import { HistoryModal } from "../documents/history/HistoryModal";
import { PageIcon } from "../documents/PageIconView";
import { childrenOf, descendantIds, groupByParent } from "../documents/pageTree";
import { dropPositionAt } from "./dropPosition";
import type { DropPosition } from "./dropPosition";

type PageGroups = Map<number | null, DocumentSummaryDto[]>;

// 새 페이지를 만들고 바로 여는 공통 동작 (parentId가 없으면 프로젝트 최상위)
function useCreatePage(spaceId: number, onCreated?: () => void) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (parentId: number | null) => createDocument(spaceId, parentId),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["documents", spaceId] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      onCreated?.();
      navigate(`/documents/${doc.id}`, focusTitleState(doc.id));
    },
  });
}

// 휴지통으로 보내고, 보고 있던 페이지면 상위 페이지(없으면 프로젝트)로 이동
function useDeletePage(page: DocumentSummaryDto, onDeleted: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteDocument(page.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["search"] });
      queryClient.removeQueries({ queryKey: ["document", page.id] });
      onDeleted();
      if (itemIdOfPath(location.pathname) === page.id) {
        navigate(page.parentId ? `/documents/${page.parentId}` : `/spaces/${page.spaceId}`);
      }
    },
  });
}

interface TreeRowProps {
  label: string;
  // 제목 앞 아이콘 (없으면 화살표만 표시)
  icon?: ReactNode;
  to: string;
  active?: boolean;
  opened: boolean;
  onToggle: () => void;
  addLabel: string;
  // + 버튼 툴팁
  addTooltip: string;
  onAdd: () => void;
  adding: boolean;
  // ⋯ 메뉴 항목 (없으면 ⋯ 버튼 미표시)
  menuItems?: ReactNode;
  // 끌기 시작 (없으면 끌 수 없는 줄)
  onDragStart?: () => void;
  // 줄 위·아래 가장자리에 놓아 형제로 끼워 넣기 허용 여부 (최상위 페이지 줄은 안쪽만)
  siblingDrop?: boolean;
  // 하위를 둘 수 없는 줄(파일·WBS): 펼치기·하위 추가·안쪽 놓기가 없음
  leaf?: boolean;
  // 줄을 선택(포커스)한 채 Delete 키를 누르면 삭제 확인 창 열기
  onDeleteKey?: () => void;
  // 지금 끌고 있는 페이지를 이 위치에 놓을 수 있는지
  canDrop: (position: DropPosition) => boolean;
  onDrop: (position: DropPosition) => void;
  // 컴퓨터에서 끌어온 파일을 이 위치에 올리기
  onDropFiles: (position: DropPosition, files: File[]) => void;
  // 줄 안 위치별 놓기 구분을 직접 정할 때 (최상위 페이지 줄)
  pagePositionOf?: (offsetY: number, height: number) => DropPosition;
  // 최상위 페이지 줄 표시 (최상위 순서 변경 목록이 줄 위치를 찾을 때 사용)
  spaceRow?: boolean;
  // 최상위 순서 변경 목록이 정한 이 줄의 가로선
  spaceDropLine?: DropPosition | null;
  children?: ReactNode;
}

// 사이드바에서 끌고 있는 최상위 페이지 (최상위 목록 영역이 놓을 위치를 계산)
let draggingSpaceId: number | null = null;

export function draggingSpace(): number | null {
  return draggingSpaceId;
}

// 컴퓨터에서 파일을 끌고 왔는지 (dragover 중에는 파일 목록 대신 종류만 확인 가능)
function isFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

// 사이드바에서 끌고 있는 페이지 (dragover 중에는 dataTransfer 값을 읽을 수 없어 따로 보관)
interface DraggingPage {
  id: number;
  spaceId: number;
  parentId: number | null;
  // 자기 하위로는 넣을 수 없음
  descendants: Set<number>;
}

let draggingPage: DraggingPage | null = null;

const DRAG_TYPE = "application/x-portal-page";

// 링크 이동 없이 버튼 동작만 실행
function stopLink(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

// 노션식 펼치기 화살표 (펼치면 아래로 회전)
function Chevron({ opened }: { opened: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden
      style={{ transform: opened ? "rotate(90deg)" : undefined, transition: "transform 120ms" }}>
      <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// 트리 한 줄: 평소엔 아이콘, 마우스를 올리면 그 자리에 펼치기 화살표와 오른쪽 + / ⋯ 버튼
function TreeRow({
  label, icon, to, active, opened, onToggle, addLabel, addTooltip, onAdd, adding, menuItems,
  onDragStart, siblingDrop = false, leaf = false, onDeleteKey, canDrop, onDrop, onDropFiles, pagePositionOf, spaceRow, spaceDropLine, children,
}: TreeRowProps) {
  const isFile = leaf;
  const [hovered, setHovered] = useState(false);
  // 끌고 있는 페이지가 이 줄 위에 있을 때 놓일 위치 (안쪽은 줄 강조, 앞·뒤는 가로선)
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  const positionOf = (e: DragEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (pagePositionOf) return pagePositionOf(e.clientY - rect.top, rect.height);
    return dropPositionAt(e.clientY - rect.top, rect.height, siblingDrop, !isFile);
  };
  // ⋯ 메뉴가 열려 있는 동안은 마우스가 벗어나도 버튼 유지
  const [menuOpened, setMenuOpened] = useState(false);
  const showActions = hovered || menuOpened;
  // 파일·WBS는 펼칠 하위가 없어 아이콘만 표시
  const showChevron = !isFile && (showActions || !icon);
  return (
    <Box>
      <NavLink
        component={RouterLink}
        to={to}
        label={label}
        active={active}
        py={4}
        pl={6}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onKeyDown={(e) => {
          if (e.key !== "Delete" || !onDeleteKey) return;
          e.preventDefault();
          onDeleteKey();
        }}
        draggable={!!onDragStart}
        data-space-row={spaceRow || undefined}
        data-drop-target={dropPosition === "inside" || undefined}
        data-drop-position={spaceDropLine ?? dropPosition ?? undefined}
        onDragStart={(e: DragEvent<HTMLAnchorElement>) => {
          if (!onDragStart) return;
          // 브라우저가 링크에 자동으로 싣는 주소를 지워 Edge "분할 화면에서 열기"나 본문 링크 삽입이 뜨지 않게 함
          e.dataTransfer.clearData();
          e.dataTransfer.setData(DRAG_TYPE, label);
          e.dataTransfer.effectAllowed = "move";
          onDragStart();
        }}
        onDragEnd={() => {
          draggingPage = null;
          draggingSpaceId = null;
        }}
        onDragOver={(e: DragEvent<HTMLAnchorElement>) => {
          const position = positionOf(e);
          // 컴퓨터에서 끌어온 파일은 어느 줄 어느 위치에나 올릴 수 있음
          if (isFileDrag(e)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDropPosition(position);
            return;
          }
          // 최상위 페이지 순서 변경은 최상위 목록 영역이 처리
          if (draggingSpaceId !== null) {
            setDropPosition(null);
            return;
          }
          if (!draggingPage || !canDrop(position)) {
            setDropPosition(null);
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropPosition(position);
        }}
        onDragLeave={() => setDropPosition(null)}
        onDrop={(e: DragEvent<HTMLAnchorElement>) => {
          setDropPosition(null);
          const position = positionOf(e);
          if (isFileDrag(e)) {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) onDropFiles(position, files);
            return;
          }
          if (draggingSpaceId !== null) return;
          if (!draggingPage || !canDrop(position)) return;
          e.preventDefault();
          onDrop(position);
          draggingPage = null;
        }}
        leftSection={
          <Box className="tree-slot" w={22} h={22}>
            {icon && <span aria-hidden className="tree-slot-icon" data-hidden={showChevron || undefined}>{icon}</span>}
            {!isFile && <UnstyledButton
              aria-label={opened ? `${label} 접기` : `${label} 펼치기`}
              className="tree-chevron"
              data-visible={showChevron || undefined}
              onClick={(e) => {
                stopLink(e);
                onToggle();
              }}
            >
              <Chevron opened={opened} />
            </UnstyledButton>}
          </Box>
        }
        rightSection={showActions ? (
          <Group gap={2} wrap="nowrap">
            {!isFile && <Tooltip label={addTooltip} withArrow openDelay={300}>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                aria-label={addLabel}
                loading={adding}
                onClick={(e) => {
                  stopLink(e);
                  onAdd();
                }}
              >
                +
              </ActionIcon>
            </Tooltip>}
            {menuItems && (
              <Menu position="bottom-start" withinPortal opened={menuOpened} onChange={setMenuOpened}>
                <Tooltip label="삭제 등" withArrow openDelay={300} disabled={menuOpened}>
                  <Menu.Target>
                    <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`${label} 메뉴`} onClick={stopLink}>
                      ⋯
                    </ActionIcon>
                  </Menu.Target>
                </Tooltip>
                {/* 포털 안의 클릭이 React 트리를 따라 링크로 전달되지 않도록 차단 */}
                <Menu.Dropdown onClick={stopLink}>{menuItems}</Menu.Dropdown>
              </Menu>
            )}
          </Group>
        ) : null}
        styles={{ section: { marginInlineEnd: 6 } }}
      />
      {opened && !isFile && <Box pl={12}>{children}</Box>}
    </Box>
  );
}

interface PageNavItemProps {
  page: DocumentSummaryDto;
  groups: PageGroups;
  spaceId: number;
  // 항목을 다른 페이지 아래(null이면 최상위)의 index 위치로 이동 (없으면 맨 아래)
  onMove: (pageId: number, parentId: number | null, index?: number) => void;
  // 컴퓨터에서 끌어온 파일을 그 위치에 파일 항목으로 올리기
  onUpload: (parentId: number | null, index: number | undefined, files: File[]) => void;
}

function PageNavItem({ page, groups, spaceId, onMove, onUpload }: PageNavItemProps) {
  const location = useLocation();
  const isFile = page.kind === "FILE";
  // 파일·WBS는 하위를 둘 수 없고, 본문이 없어 내보내기·수정 이력이 없음
  const isLeaf = page.kind === "FILE" || page.kind === "WBS";
  const path = itemPath(page.kind, page.id);
  const [opened, setOpened] = useState(false);
  const create = useCreatePage(spaceId, () => setOpened(true));
  const children = childrenOf(groups, page.id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeletePage(page, () => setConfirmDelete(false));
  const [exporting, setExporting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);
  // 펼친 줄 아래쪽에 놓으면 노션처럼 그 페이지의 첫 하위로 들어감
  const afterAsFirstChild = !isLeaf && opened && children.length > 0;

  // 놓은 위치에 해당하는 새 상위 페이지와 순서 (excludedId: 형제 목록에서 뺄 끌고 있는 항목)
  const placementOf = (position: DropPosition, excludedId?: number) => {
    if (position === "inside") return { parentId: page.id as number | null, index: undefined };
    if (position === "after" && afterAsFirstChild) return { parentId: page.id as number | null, index: 0 };
    const siblings = childrenOf(groups, page.parentId).filter((p) => p.id !== excludedId);
    const index = siblings.findIndex((p) => p.id === page.id) + (position === "after" ? 1 : 0);
    return { parentId: page.parentId, index };
  };

  // 같은 최상위 페이지 안의 다른 항목이고, 이 줄이 끌고 있는 페이지의 하위가 아닐 때만
  const canDrop = (position: DropPosition) => {
    if (!draggingPage || draggingPage.spaceId !== spaceId || draggingPage.id === page.id
      || draggingPage.descendants.has(page.id)) {
      return false;
    }
    // 이미 바로 아래에 있는 항목을 다시 안쪽(맨 아래)으로 넣는 것은 변화 없음
    if (position === "inside") return draggingPage.parentId !== page.id;
    return true;
  };

  const drop = (position: DropPosition) => {
    if (!draggingPage) return;
    const { parentId, index } = placementOf(position, draggingPage.id);
    onMove(draggingPage.id, parentId, index);
    if (position === "inside") setOpened(true);
  };

  const dropFiles = (position: DropPosition, files: File[]) => {
    const { parentId, index } = placementOf(position);
    onUpload(parentId, index, files);
    if (position === "inside") setOpened(true);
  };

  return (
    <>
      <TreeRow
        label={page.title}
        icon={<PageIcon icon={page.icon} />}
        // 파일 항목은 미리보기 화면, WBS는 일정표, 페이지는 편집 화면
        to={path}
        leaf={isLeaf}
        active={location.pathname === path}
        opened={opened}
        onToggle={() => setOpened((v) => !v)}
        addLabel={`${page.title}에 하위 페이지 추가`}
        addTooltip="하위 페이지 추가"
        onAdd={() => create.mutate(page.id)}
        adding={create.isPending}
        onDeleteKey={() => setConfirmDelete(true)}
        menuItems={
          <>
            {isFile && page.fileUrl && (
              <Menu.Item component="a" href={page.fileUrl} download={page.title}>다운로드</Menu.Item>
            )}
            <CopyLinkMenuItem path={path} />
            {!isLeaf && <Menu.Item onClick={() => setExporting(true)}>내보내기</Menu.Item>}
            {!isLeaf && <Menu.Item onClick={() => setShowingHistory(true)}>수정 이력</Menu.Item>}
            <Menu.Divider />
            <Menu.Item color="red" onClick={() => setConfirmDelete(true)}>
              {isFile ? "파일 삭제" : page.kind === "WBS" ? "WBS 삭제" : "페이지 삭제"}
            </Menu.Item>
          </>
        }
        onDragStart={() => {
          draggingPage = { id: page.id, spaceId, parentId: page.parentId, descendants: descendantIds(groups, page.id) };
        }}
        siblingDrop
        canDrop={canDrop}
        onDrop={drop}
        onDropFiles={dropFiles}
      >
        {children.map((child) => (
          <PageNavItem key={child.id} page={child} groups={groups} spaceId={spaceId} onMove={onMove} onUpload={onUpload} />
        ))}
        {children.length === 0 && <Text size="xs" c="dimmed" px="sm" py={4}>하위 페이지 없음</Text>}
      </TreeRow>
      {/* 링크 밖에 두어 확인 창 안의 클릭이 페이지 이동으로 이어지지 않게 함 */}
      {!isLeaf && (
        <ExportModal opened={exporting} documentId={page.id} title={page.title} onClose={() => setExporting(false)} />
      )}
      {!isLeaf && (
        <HistoryModal opened={showingHistory} documentId={page.id} title={page.title} onClose={() => setShowingHistory(false)} />
      )}
      <DeletePageModal
        opened={confirmDelete}
        title={page.title}
        kind={page.kind}
        pending={remove.isPending}
        error={remove.error ? (remove.error instanceof ApiError ? remove.error.message : "삭제하지 못했습니다.") : null}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

// 사이드바의 프로젝트: 하위 페이지를 노션처럼 여러 단계 트리로 펼침
// 프로젝트를 휴지통으로 보내고, 그 프로젝트나 소속 페이지를 보고 있었으면 사이드바 옆 최상위 페이지로 이동
function useDeleteSpace(space: SpaceDto, onDeleted: () => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteSpace(space.id),
    onSuccess: () => {
      // 목록을 다시 불러오기 전에 지운 페이지의 위치로 다음 페이지를 정함
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

// 펼친 페이지 목록 맨 끝의 얇은 놓기 띠: 마지막 줄 아래쪽을 정확히 짚지 않아도 맨 아래로 넣음
function EndDropZone({ canDrop, onDrop, onDropFiles }: {
  canDrop: () => boolean;
  onDrop: () => void;
  onDropFiles: (files: File[]) => void;
}) {
  const [active, setActive] = useState(false);
  return (
    <Box
      className="tree-end-drop"
      data-testid="tree-end-drop"
      h={8}
      data-drop-position={active ? "before" : undefined}
      onDragOver={(e: DragEvent<HTMLDivElement>) => {
        const files = isFileDrag(e);
        if (!files && (draggingSpaceId !== null || !canDrop())) {
          setActive(false);
          return;
        }
        e.preventDefault();
        e.dataTransfer.dropEffect = files ? "copy" : "move";
        setActive(true);
      }}
      onDragLeave={() => setActive(false)}
      onDrop={(e: DragEvent<HTMLDivElement>) => {
        setActive(false);
        if (isFileDrag(e)) {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files);
          if (files.length > 0) onDropFiles(files);
          return;
        }
        if (draggingSpaceId !== null || !canDrop()) return;
        e.preventDefault();
        onDrop();
        draggingPage = null;
      }}
    />
  );
}

interface SpaceNavItemProps {
  space: SpaceDto;
  // 끌어서 최상위 순서를 바꿀 수 있는 줄인지
  reorderable?: boolean;
  // 최상위 순서 변경 중 이 줄에 그을 가로선
  dropLine?: DropPosition | null;
}

export function SpaceNavItem({ space, reorderable = false, dropLine = null }: SpaceNavItemProps) {
  const [opened, setOpened] = useState(false);
  const create = useCreatePage(space.id, () => setOpened(true));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteSpace(space, () => setConfirmDelete(false));
  const [exporting, setExporting] = useState(false);
  const [showingHistory, setShowingHistory] = useState(false);

  const { data: pages = [] } = useQuery({
    queryKey: ["documents", space.id],
    queryFn: () => listDocuments(space.id),
    enabled: opened,
  });
  const groups = groupByParent(pages);
  const topLevel = childrenOf(groups, null);

  // 페이지 이동 후 트리와 열려 있는 페이지의 상위 경로 갱신
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: ({ pageId, parentId, index }: { pageId: number; parentId: number | null; index?: number }) =>
      moveDocument(pageId, parentId, index),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", space.id] });
      queryClient.invalidateQueries({ queryKey: ["document"] });
    },
  });
  const onMove = (pageId: number, parentId: number | null, index?: number) => move.mutate({ pageId, parentId, index });

  // 끌어온 파일을 고른 순서대로 이어서 올리고(위치가 있으면 차례로 한 칸씩 뒤), 실패한 파일만 모아 안내
  const upload = useMutation({
    mutationFn: async ({ parentId, index, files }: { parentId: number | null; index?: number; files: File[] }) => {
      const failed: string[] = [];
      for (const [i, file] of files.entries()) {
        try {
          await uploadFileNode(space.id, file, parentId, index === undefined ? undefined : index + i - failed.length);
        } catch (error) {
          failed.push(`${file.name} (${error instanceof ApiError ? error.message : "업로드 실패"})`);
        }
      }
      return failed;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", space.id] });
      queryClient.invalidateQueries({ queryKey: ["spaces"] });
    },
  });
  const onUpload = (parentId: number | null, index: number | undefined, files: File[]) => {
    setOpened(true);
    upload.mutate({ parentId, index, files });
  };
  const uploadFailed = upload.data ?? [];

  return (
    <>
      <TreeRow
        label={space.name}
        icon={<PageIcon icon={space.icon} />}
        to={`/spaces/${space.id}`}
        opened={opened}
        onToggle={() => setOpened((v) => !v)}
        addLabel={`${space.name}에 페이지 추가`}
        addTooltip="페이지 추가"
        onAdd={() => create.mutate(null)}
        adding={create.isPending}
        onDeleteKey={() => setConfirmDelete(true)}
        menuItems={
          <>
            <CopyLinkMenuItem path={`/spaces/${space.id}`} />
            {space.homeDocumentId !== null && (
              <Menu.Item onClick={() => setExporting(true)}>내보내기</Menu.Item>
            )}
            {space.homeDocumentId !== null && (
              <Menu.Item onClick={() => setShowingHistory(true)}>수정 이력</Menu.Item>
            )}
            <Menu.Divider />
            <Menu.Item color="red" onClick={() => setConfirmDelete(true)}>
              페이지 삭제
            </Menu.Item>
          </>
        }
        // 최상위 페이지 줄에 놓으면 그 안의 맨 아래로 이동 (이미 바로 아래면 무시)
        // 펼쳐서 페이지가 보일 때 줄 아래쪽 절반에 놓으면 노션처럼 그 안의 맨 위로
        pagePositionOf={(offsetY, height) =>
          height > 0 && opened && topLevel.length > 0 && offsetY > height / 2 ? "after" : "inside"}
        canDrop={(position) => {
          if (!draggingPage || draggingPage.spaceId !== space.id) return false;
          if (position === "after") return topLevel[0]?.id !== draggingPage.id;
          return draggingPage.parentId !== null;
        }}
        onDrop={(position) => {
          if (draggingPage) onMove(draggingPage.id, null, position === "after" ? 0 : undefined);
        }}
        onDropFiles={(position, files) => onUpload(null, position === "after" ? 0 : undefined, files)}
        onDragStart={reorderable ? () => {
          draggingSpaceId = space.id;
        } : undefined}
        spaceRow
        spaceDropLine={dropLine}
      >
        {move.error && (
          <Text size="xs" c="red" px="sm" py={4}>
            {move.error instanceof ApiError ? move.error.message : "옮기지 못했습니다."}
          </Text>
        )}
        {upload.isPending && <Text size="xs" c="dimmed" px="sm" py={4}>파일 올리는 중…</Text>}
        {uploadFailed.length > 0 && (
          <Text size="xs" c="red" px="sm" py={4}>올리지 못한 파일: {uploadFailed.join(", ")}</Text>
        )}
        {topLevel.map((page) => (
          <PageNavItem key={page.id} page={page} groups={groups} spaceId={space.id} onMove={onMove} onUpload={onUpload} />
        ))}
        {topLevel.length === 0 && <Text size="xs" c="dimmed" px="sm" py={4}>페이지 없음</Text>}
        {topLevel.length > 0 && (
          <EndDropZone
            canDrop={() => !!draggingPage && draggingPage.spaceId === space.id
              && !(draggingPage.parentId === null && topLevel[topLevel.length - 1].id === draggingPage.id)}
            onDrop={() => {
              if (draggingPage) onMove(draggingPage.id, null);
            }}
            onDropFiles={(files) => onUpload(null, undefined, files)}
          />
        )}
      </TreeRow>
      {/* 링크 밖에 두어 확인 창 안의 클릭이 페이지 이동으로 이어지지 않게 함 */}
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
        pending={remove.isPending}
        error={remove.error ? (remove.error instanceof ApiError ? remove.error.message : "페이지를 삭제하지 못했습니다.") : null}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
