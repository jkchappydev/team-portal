import { useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { ActionIcon, Alert, Box, Button, Group, Menu, Modal, NavLink, Stack, Text, Tooltip } from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteLink, listLinks, LINKS_KEY, moveLink } from "../api/links";
import type { LinkDto } from "../api/links";
import { copyText } from "../documents/clipboard";
import { dropSlotAt, moveIndexOf } from "../documents/dropSlot";
import { showToast } from "../toast/toastStore";
import { LinkDialog } from "./LinkDialog";
import { LinkInfoDialog } from "./LinkInfoDialog";
import { isNewItem, useReorderAnimation } from "./reorderAnimation";

const DRAG_TYPE = "application/x-portal-link";

// ⋯ 버튼·메뉴 클릭이 링크 열기로 이어지지 않게 차단
function stopLink(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
}

// 사이드바 "링크" 영역: 팀이 함께 쓰는 외부 주소 목록 (끌어서 순서 변경, 새 탭으로 열기)
export function LinkList() {
  const queryClient = useQueryClient();
  // 링크 팝업: null = 닫힘, editing 없음 = 추가, 있음 = 그 링크 수정
  const [dialog, setDialog] = useState<{ editing: LinkDto | null } | null>(null);
  // 계정 정보가 있는 링크를 눌렀을 때 뜨는 팝업
  const [infoLink, setInfoLink] = useState<LinkDto | null>(null);
  const { data: links = [] } = useQuery({ queryKey: LINKS_KEY, queryFn: listLinks });
  const listRef = useRef<HTMLDivElement>(null);
  // 끌고 있는 링크와 가로선을 그을 줄 사이 위치 (0 = 맨 앞, links.length = 맨 뒤)
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  useReorderAnimation(listRef, '[data-flip-id^="link-"]');

  // 화면 순서를 먼저 바꾸고 서버 반영 후 다시 조회 (실패 시 서버 순서로 복구)
  const reorder = useMutation({
    mutationFn: ({ id, index }: { id: number; index: number }) => moveLink(id, index),
    onMutate: ({ id, index }) => {
      const current = queryClient.getQueryData<LinkDto[]>(LINKS_KEY) ?? [];
      const moving = current.find((l) => l.id === id);
      if (!moving) return;
      const others = current.filter((l) => l.id !== id);
      others.splice(index, 0, moving);
      queryClient.setQueryData(LINKS_KEY, others);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: LINKS_KEY }),
  });

  const slotOf = (e: DragEvent<HTMLElement>): number => {
    const rows = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-link-row]") ?? []);
    return dropSlotAt(e.clientY, rows.map((row) => row.getBoundingClientRect()));
  };
  const lineOf = (index: number) => {
    if (slot === index) return "before";
    if (slot === links.length && index === links.length - 1) return "after";
    return undefined;
  };

  return (
    <>
      <Group justify="space-between" mt="sm">
        <Text size="xs" c="dimmed">링크</Text>
        <Button size="compact-xs" variant="subtle" onClick={() => setDialog({ editing: null })}>+ 링크 추가</Button>
      </Group>
      <Box
        data-testid="link-list"
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          if (draggingId === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setSlot(slotOf(e));
        }}
        onDragLeave={(e: DragEvent<HTMLDivElement>) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSlot(null);
        }}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          const id = draggingId;
          setSlot(null);
          setDraggingId(null);
          if (id === null) return;
          e.preventDefault();
          const index = moveIndexOf(slotOf(e), links.findIndex((l) => l.id === id));
          if (index !== null) reorder.mutate({ id, index });
        }}
      >
        <Box ref={listRef}>
          {links.map((link, index) => (
            <LinkRow key={link.id} link={link} dropLine={lineOf(index)}
              onEdit={() => setDialog({ editing: link })}
              onShowInfo={() => setInfoLink(link)}
              onDragStart={() => setDraggingId(link.id)}
              onDragEnd={() => {
                setDraggingId(null);
                setSlot(null);
              }} />
          ))}
        </Box>
      </Box>
      <LinkDialog opened={dialog !== null} editing={dialog?.editing} onClose={() => setDialog(null)} />
      <LinkInfoDialog link={infoLink} onClose={() => setInfoLink(null)} />
    </>
  );
}

interface LinkRowProps {
  link: LinkDto;
  dropLine?: "before" | "after";
  onEdit: () => void;
  // 계정 정보 팝업 열기
  onShowInfo: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function LinkRow({ link, dropLine, onEdit, onShowInfo, onDragStart, onDragEnd }: LinkRowProps) {
  const queryClient = useQueryClient();
  const [hovered, setHovered] = useState(false);
  const [menuOpened, setMenuOpened] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isNew] = useState(() => isNewItem(`link-${link.id}`));

  const remove = useMutation({
    mutationFn: () => deleteLink(link.id),
    onSuccess: () => {
      setConfirmDelete(false);
      void queryClient.invalidateQueries({ queryKey: LINKS_KEY });
    },
  });

  return (
    <>
      <Tooltip label={link.url} openDelay={500} withArrow position="right" multiline maw={360}>
        <NavLink
          component="a"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          label={link.title}
          noWrap
          py={4}
          pl={6}
          data-link-row
          data-flip-id={`link-${link.id}`}
          data-new={isNew || undefined}
          data-drop-position={dropLine}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onClick={(e: MouseEvent) => {
            // 계정 정보가 있으면 바로 열지 않고 팝업(링크 이동·계정 정보), 없으면 그대로 새 탭 (Ctrl·가운데 클릭도 그대로)
            if (!link.accountInfo || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            onShowInfo();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Delete") return;
            e.preventDefault();
            setConfirmDelete(true);
          }}
          draggable
          onDragStart={(e: DragEvent<HTMLAnchorElement>) => {
            // 브라우저가 링크에 자동으로 싣는 주소를 지워 본문 등에 주소가 끼어들지 않게 함
            e.dataTransfer.clearData();
            e.dataTransfer.setData(DRAG_TYPE, link.title);
            e.dataTransfer.effectAllowed = "move";
            onDragStart();
          }}
          onDragEnd={onDragEnd}
          leftSection={<Box className="tree-slot" w={22} h={22}><span aria-hidden>{link.icon ?? "🔗"}</span></Box>}
          rightSection={hovered || menuOpened ? (
            <Menu position="bottom-start" withinPortal opened={menuOpened} onChange={setMenuOpened}>
              <Menu.Target>
                <ActionIcon size="xs" variant="subtle" color="gray" aria-label={`${link.title} 메뉴`} onClick={stopLink}>⋯</ActionIcon>
              </Menu.Target>
              <Menu.Dropdown onClick={stopLink}>
                <Menu.Item onClick={onEdit}>링크 수정</Menu.Item>
                <Menu.Item onClick={() => {
                  copyText(link.url)
                    .then(() => showToast("링크를 복사했습니다"))
                    .catch(() => showToast("링크를 복사하지 못했습니다"));
                }}>링크 복사</Menu.Item>
                <Menu.Divider />
                <Menu.Item color="red" onClick={() => setConfirmDelete(true)}>링크 삭제</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : null}
          styles={{ section: { marginInlineEnd: 6 } }}
        />
      </Tooltip>
      <Modal opened={confirmDelete} onClose={() => setConfirmDelete(false)} title="링크 삭제" centered>
        <Stack>
          <Text size="sm">"{link.title}" 링크를 삭제할까요? 팀원 모두의 사이드바에서 사라집니다.</Text>
          {remove.error && <Alert color="red">링크를 삭제하지 못했습니다.</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirmDelete(false)}>취소</Button>
            <Button color="red" loading={remove.isPending} onClick={() => remove.mutate()} data-autofocus>삭제</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
