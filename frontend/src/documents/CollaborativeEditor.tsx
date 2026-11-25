import "@blocknote/core/fonts/inter.css";
// Mantine 기본 스타일은 main.tsx에서 한 번만 불러옴 (style.css는 Mantine을 한 벌 더 넣어, 편집기를 연 뒤 다른 화면의 여백 등을 덮어씀)
import "@blocknote/mantine/blocknoteStyles.css";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { CalloutLineIcon, ColumnsLineIcon, ScheduleLineIcon } from "./DefaultIcons";
import { Alert, Badge, Box, Button, Group, Loader, Text, useComputedColorScheme } from "@mantine/core";
import { ko } from "@blocknote/core/locales";
import { withCollaboration } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/mantine";
import { useNavigate } from "react-router-dom";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { isOutsideTable, NEW_CALLOUT, withCalloutItem } from "./editor/calloutCommand";
import { AlignedSideMenuController } from "./editor/AlignedSideMenuController";
import { syntaxHighlighter } from "@blocknote/code-block";
import { editorPasteHandler, keepLineTypeOnPasteExtension } from "./editor/paste";
import { autolinkFilterExtension } from "./editor/autolink";
import { yUndoPluginKey } from "y-prosemirror";
import { reviveUndoManager } from "./editor/undoRevive";
import { NotionFormattingToolbarController } from "./editor/FormattingToolbarPosition";
import { FORMAT_SHORTCUTS, formatShortcutsExtension } from "./editor/formatShortcuts";
import { activeTableCellExtension } from "./editor/activeTableCell";
import { tableHandleDragExtension } from "./editor/tableHandleDrag";
import { checkListAnimationExtension } from "./editor/checkListAnimation";
import { blockDropExtension, notionDropCursor } from "./editor/blockDrop";
import { calloutBackspaceExtension } from "./editor/calloutBackspace";
import { undoAnywhereExtension } from "./editor/undoAnywhere";
import { outsidePressReleaseExtension } from "./editor/outsidePressRelease";
import { blockMarqueeExtension, installBlockMarquee } from "./editor/blockMarquee";
import {
  getDefaultReactSlashMenuItems, SuggestionMenuController, TableHandlesController,
  useCreateBlockNote,
} from "@blocknote/react";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { claimPageBlockBackfill, createDocument, deleteDocument, duplicateDocument, moveDocument, restoreDocument } from "../api/documents";
import { adoptPastedPages, BLOCKS_CUT_EVENT, clearPageCut, isPageCut, pageIdsIn, recordPageCut } from "./editor/pagePaste";
import { createPageRemovalTracker } from "./editor/pageRemoval";
import { appendBlocksToDocument, isPageMoved, moveBlocksToPage, MOVE_INTO_PAGE_EVENT, OPEN_MOVE_PICKER_EVENT } from "./editor/blockMove";
import type { MoveIntoPageDetail } from "./editor/blockMove";
import { SearchDialog } from "./SearchDialog";
import { showToast } from "../toast/toastStore";
import type { QueryClient } from "@tanstack/react-query";
import { PageCopyContext } from "./editor/pageCopyContext";
import type { PageCopyActions } from "./editor/pageCopyContext";
import { appendMissingPageBlocks } from "./editor/pageCommand";
import type { PageEditor } from "./editor/pageCommand";
import { pageSlashItem } from "./editor/pageSlashItem";
import { waitUntilSynced } from "./collabSession";
import { openCreatedPage } from "./titleFocus";
import { insertColumns, isInsideColumn } from "./editor/columnCommand";
import { placeScheduleBlock } from "./editor/scheduleCommand";
import type { ScheduleEditor } from "./editor/scheduleCommand";
import { editorSchema } from "./editor/schema";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { uploadAttachment } from "../api/attachments";
import { fetchCollabTicket } from "../api/collab";
import { JOB_RANKS, listMembers } from "../api/members";
import type { MemberDto } from "../api/members";
import { filterMentionCandidates } from "./editor/mentionCandidates";
import { collabUrl, FRAGMENT_NAME } from "./collab";
import { createCursorActivity, editingClientIds, renderCursor } from "./cursorActivity";
import type { CursorUser } from "./cursorActivity";
import { NotionSideMenu } from "./editor/NotionSideMenu";
import { CellSelectionMenu } from "./editor/CellSelectionMenu";
import { sameViewers, viewersOf } from "./presence";
import type { PresenceUser, Viewer } from "./presence";
import { dropTargetAt, insertDroppedFiles } from "./fileDrop";
import type { DropEditor } from "./fileDrop";
import { focusEditorEnd, isBelowLastBlock, isInFloatingUi, releaseBlockSelection } from "./editorEnd";
import type { EndEditor, SelectionEditor } from "./editorEnd";
import { userColor } from "./userColor";


interface Props {
  documentId: number;
  user: MemberDto;
  // 이 문서가 속한 프로젝트: 슬래시 메뉴 "/페이지"·"/일정"으로 이 아래에 만들 때 사용 (없으면 두 메뉴 제외, 기존 하위 항목 자동 삽입도 안 함)
  spaceId?: number;
  // 지금 이 페이지를 보고 있는 사람(나 포함) 목록이 바뀔 때 알림
  onViewersChange?: (viewers: Viewer[]) => void;
}

interface Session {
  doc: Y.Doc;
  provider: HocuspocusProvider;
}


// 문서가 바뀌면 상위에서 key로 다시 마운트하므로 상태 초기화는 마운트 단위로 처리
export default function CollaborativeEditor({ documentId, user, spaceId, onViewersChange }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [unsynced, setUnsynced] = useState(false);
  const onViewersChangeRef = useRef(onViewersChange);
  useEffect(() => {
    onViewersChangeRef.current = onViewersChange;
  }, [onViewersChange]);

  // 문서·사용자 단위로 연결 생성, 정리 시 provider와 doc 해제 (StrictMode 재마운트에도 살아 있는 연결은 하나)
  useEffect(() => {
    const doc = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: collabUrl(),
      name: `document-${documentId}`,
      token: fetchCollabTicket,
      document: doc,
    });
    const current: Session = { doc, provider };
    const onStatus = ({ status }: { status: string }) => setConnected(status === "connected");
    // 서버 내용을 받은 뒤에 편집기를 만들어 빈 문서가 먼저 쓰이지 않게 함
    const onSynced = ({ state }: { state: boolean }) => {
      if (state) setSession(current);
    };
    const onAuthFailed = () => setAuthFailed(true);
    // 서버에 아직 반영되지 않은 변경 여부 추적
    const onUnsyncedChanges = () => setUnsynced(provider.hasUnsyncedChanges);
    provider.on("status", onStatus);
    provider.on("synced", onSynced);
    provider.on("authenticationFailed", onAuthFailed);
    provider.on("unsyncedChanges", onUnsyncedChanges);

    // 접속 상태(awareness)가 바뀔 때마다 나를 포함한 보는 사람 목록 전달, 목록이 같으면 알리지 않음
    const awareness = provider.awareness;
    const last: { viewers: Viewer[] } = { viewers: [] };
    const onAwarenessChange = () => {
      if (!awareness) return;
      const next = viewersOf(awareness.getStates() as Map<number, Record<string, unknown>>, user.id);
      if (sameViewers(last.viewers, next)) return;
      last.viewers = next;
      onViewersChangeRef.current?.(next);
    };
    awareness?.on("change", onAwarenessChange);

    return () => {
      awareness?.off("change", onAwarenessChange);
      onViewersChangeRef.current?.([]);
      provider.off("status", onStatus);
      provider.off("synced", onSynced);
      provider.off("authenticationFailed", onAuthFailed);
      provider.off("unsyncedChanges", onUnsyncedChanges);
      provider.destroy();
      doc.destroy();
      setSession((prev) => (prev === current ? null : prev));
      setConnected(false);
      setUnsynced(false);
    };
  }, [documentId, user.id]);

  // 미반영 변경이 남아 있으면 페이지 이탈 시 브라우저 경고 표시
  useEffect(() => {
    if (!unsynced) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsynced]);

  // 연결이 끊긴 동안의 입력은 유실될 수 있어 읽기 전용으로 전환
  const editable = connected && !authFailed;

  return (
    <Box>
      {/* 정상 연결 상태는 표시하지 않고 거부·재연결 상태만 안내 */}
      {(authFailed || !connected) && (
        <Group gap="xs" mb={6}>
          {authFailed ? (
            <Badge color="red" variant="light" size="sm">접속 거부됨</Badge>
          ) : (
            <Badge color="yellow" variant="dot" size="sm">재연결 중</Badge>
          )}
          {!authFailed && session && (
            <Text size="xs" c="dimmed">연결이 끊겨 읽기 전용입니다. 다시 연결되면 편집할 수 있습니다.</Text>
          )}
        </Group>
      )}
      {/* backend 일시 장애 등으로 접속이 거부되면 provider가 재시도하지 않으므로 새로고침 안내 */}
      {authFailed && (
        <Alert color="red" variant="light" mb="sm" title="문서에 접속하지 못했습니다">
          <Text size="sm" mb="xs">서버가 잠시 응답하지 않았을 수 있습니다. 잠시 후 새로고침하세요.</Text>
          {/* 안내 상자와 같은 연한 빨강 배경(light)이면 버튼 경계가 안 보여 테두리 버튼 사용 */}
          <Button size="xs" variant="outline" color="red" onClick={() => window.location.reload()}>새로고침</Button>
        </Alert>
      )}
      {session ? (
        <EditorView
          key={`${documentId}-${user.id}`}
          session={session}
          documentId={documentId}
          user={user}
          editable={editable}
          spaceId={spaceId}
        />
      ) : authFailed ? null : (
        <Group gap="xs" p="md">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">문서를 불러오는 중...</Text>
        </Group>
      )}
    </Box>
  );
}

// 한국어 문구는 코드 버튼 단축키 칸이 비어 있어 Ctrl+E를 채움
const editorDictionary = {
  ...ko,
  formatting_toolbar: {
    ...ko.formatting_toolbar,
    code: { ...ko.formatting_toolbar.code, secondary_tooltip: FORMAT_SHORTCUTS.code },
  },
};

// 접속 상태에 싣는 내 정보 (커서 색은 팀원 번호로 고정, 동그라미는 고른 색·이미지 우선)
function presenceUser(user: Pick<MemberDto, "id" | "name" | "profileColor" | "profileImageUrl">) {
  return {
    name: user.name,
    color: userColor(user.id),
    memberId: user.id,
    profileColor: user.profileColor ?? null,
    imageUrl: user.profileImageUrl ?? null,
  } satisfies PresenceUser;
}

// 표 칸을 누르면 모서리에 뜨는 칸 메뉴 버튼을 그리지 않음 (행·열 색칠은 행·열 손잡이 메뉴로)
function HiddenCellButton() {
  return null;
}

// 페이지를 옮기거나 지운 뒤 화면 목록(사이드바·하위 페이지·휴지통 등)을 다시 받음
function refreshPageQueries(queryClient: QueryClient, pageId: number): void {
  void queryClient.invalidateQueries({ queryKey: ["document", pageId] });
  void queryClient.invalidateQueries({ queryKey: ["documents"] });
  void queryClient.invalidateQueries({ queryKey: ["spaces"] });
  void queryClient.invalidateQueries({ queryKey: ["trash"] });
}

// BlockNote 편집기는 외부 가변 객체이고 isEditable 세터가 공식 잠금 API
function setEditorEditable(editor: { isEditable: boolean }, editable: boolean): void {
  editor.isEditable = editable;
}

interface EditorViewProps {
  session: Session;
  documentId: number;
  user: MemberDto;
  editable: boolean;
  spaceId?: number;
}

function EditorView({ session, documentId, user, editable, spaceId }: EditorViewProps) {
  const navigate = useNavigate();
  // 편집기 테마를 앱의 라이트/다크 설정에 맞춤
  const colorScheme = useComputedColorScheme("light");
  const editor = useCreateBlockNote(
    withCollaboration({
      // 기본 블록 + 일정(WBS) 블록
      schema: editorSchema,
      dictionary: editorDictionary,
      collaboration: {
        provider: { awareness: session.provider.awareness ?? undefined },
        fragment: session.doc.getXmlFragment(FRAGMENT_NAME),
        // memberId로 커서와 실제 편집자를 맞춤, 프로필 색·이미지는 보는 사람 표시용
        user: presenceUser(user),
        // 이름표 표시는 아래 문서 변경 감시로 직접 처리 (기본 방식은 커서 위치만 바뀌어도 이름을 띄워 엉뚱한 사람이 표시됨)
        showCursorLabels: "always",
        renderCursor: (cursorUser) => renderCursor(cursorUser as CursorUser),
      },
      // 본문에 넣는 파일은 inline 첨부로 업로드 후 다운로드 URL 사용
      uploadFile: (file: File) => uploadAttachment(documentId, file, true).then((a) => a.url),
      // 서식(HTML)이 함께 오면 항상 HTML로 붙여넣고, 줄 전체를 선택한 채 붙여넣어도 토글 등 블록 종류를 유지
      pasteHandler: editorPasteHandler,
      // 코드 블록 문법 색칠 (언어별 문법은 필요할 때 불러옴)
      extensions: [syntaxHighlighter, formatShortcutsExtension, activeTableCellExtension, tableHandleDragExtension,
        checkListAnimationExtension, blockDropExtension(), blockMarqueeExtension(), calloutBackspaceExtension, keepLineTypeOnPasteExtension, autolinkFilterExtension,
        undoAnywhereExtension(), outsidePressReleaseExtension()],
      // 블록 이동 시 놓일 위치 표시줄 (기본 5px은 두꺼워 노션처럼 얇게), 위치는 노션식 계산 (editor/blockDrop.ts)
      dropCursor: { width: 3, color: "var(--mantine-primary-color-filled)", hooks: notionDropCursor },
      // 노션처럼 표의 행·열 색칠(배경·글자), 첫 행·첫 열 머리글, 셀 병합·분할 허용
      tables: { cellBackgroundColor: true, cellTextColor: true, headers: true, splitCells: true },
    }),
    [session, documentId, user.id, user.name],
  );

  // editable prop은 뷰를 다시 마운트하므로 편집기 인스턴스 상태만 전환
  useEffect(() => {
    setEditorEditable(editor, editable);
  }, [editor, editable]);

  // 편집 화면이 다시 붙을 때 파괴된 되돌리기(Ctrl+Z) 기록 복구 (StrictMode 개발 환경에서 되돌리기가 동작하지 않던 문제)
  useEffect(() => {
    const revive = () => {
      reviveUndoManager(yUndoPluginKey.getState(editor.prosemirrorState)?.undoManager);
    };
    revive();
    return editor.onMount(revive);
  }, [editor]);

  // 내 설정에서 색·이미지를 바꾸면 편집기를 새로 만들지 않고 다른 사람에게 보이는 내 정보만 갱신
  const { profileColor, profileImageUrl } = user;
  useEffect(() => {
    session.provider.awareness?.setLocalStateField("user",
      presenceUser({ id: user.id, name: user.name, profileColor, profileImageUrl }));
  }, [session, user.id, user.name, profileColor, profileImageUrl]);

  // 다른 사람이 실제로 글을 고친 경우에만 그 사람 커서에 이름표 표시
  const editorBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = editorBoxRef.current;
    const awareness = session.provider.awareness;
    if (!container || !awareness) return;
    const activity = createCursorActivity(container);
    const onUpdate = (update: Uint8Array) => {
      for (const clientId of editingClientIds(update)) {
        if (clientId === session.doc.clientID) continue;
        const memberId = (awareness.getStates().get(clientId)?.user as CursorUser | undefined)?.memberId;
        if (memberId != null) activity.activate(memberId);
      }
    };
    session.doc.on("update", onUpdate);
    return () => {
      session.doc.off("update", onUpdate);
      activity.dispose();
    };
  }, [session]);

  // 노션처럼 블록 바깥 여백에서 끌어 여러 블록 고르기 (페이지 본문 영역 전체에서 시작 가능)
  useEffect(() => {
    const box = editorBoxRef.current;
    if (!box) return;
    const controller = new AbortController();
    installBlockMarquee(editor, box.closest<HTMLElement>(".mantine-AppShell-main") ?? box, controller.signal);
    return () => controller.abort();
  }, [editor]);

  // "/일정": 이 페이지 아래에 WBS 항목을 만들고, 슬래시를 입력한 줄에 그 일정 블록을 넣음
  const queryClient = useQueryClient();
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  // 콜아웃: 지금 줄이 비어 있으면 그 줄을, 글이 있으면 아래에 새 콜아웃을 넣고 안의 빈 줄로 커서 이동
  const calloutItem: DefaultReactSuggestionItem = {
    title: "콜아웃",
    subtext: "이모지와 배경색으로 눈에 띄게 쓰기",
    aliases: ["콜아웃", "callout", "강조", "메모", "알림"],
    group: ko.slash_menu.quote.group,
    icon: <CalloutLineIcon size={18} />,
    onItemClick: () => {
      const callout = insertOrUpdateBlockForSlashMenu(editor, NEW_CALLOUT);
      if (callout.children[0]) editor.setTextCursorPosition(callout.children[0], "start");
    },
  };

  // "/2단"·"/3단": 블록을 가로로 나란히 놓는 열 묶음 (열 안에서는 메뉴에 보이지 않음)
  const columnItems: DefaultReactSuggestionItem[] = [2, 3].map((count) => ({
    title: `${count}단`,
    subtext: `블록을 ${count}개 열로 나란히 놓기`,
    aliases: [`${count}단`, `${count}열`, "열", "단", "columns", `${count}columns`],
    group: ko.slash_menu.quote.group,
    icon: <ColumnsLineIcon size={18} count={count as 2 | 3} />,
    onItemClick: () => insertColumns(editor as unknown as Parameters<typeof insertColumns>[0], count),
  }));

  const scheduleItem: DefaultReactSuggestionItem = {
    title: "일정",
    subtext: "WBS 표와 간트 차트",
    aliases: ["일정", "wbs", "schedule", "간트", "gantt"],
    group: "기타",
    icon: <ScheduleLineIcon size={18} />,
    onItemClick: () => {
      if (spaceId === undefined) return;
      const block = editor.getTextCursorPosition().block;
      setScheduleError(null);
      createDocument(spaceId, documentId, "일정", "WBS")
        .then((created) => {
          void queryClient.invalidateQueries({ queryKey: ["documents", spaceId] });
          void queryClient.invalidateQueries({ queryKey: ["spaces"] });
          placeScheduleBlock(editor as unknown as ScheduleEditor, block, created.id);
        })
        .catch((error: unknown) => setScheduleError(error instanceof ApiError ? error.message : "일정을 만들지 못했습니다."));
    },
  };

  // "/페이지": 이 문서 아래에 새 페이지를 만들고 슬래시를 친 자리에 페이지 블록을 넣음 (오류는 일정과 같은 안내 칸)
  // @멘션 후보: 활성 팀원 (팀원 목록 화면과 같은 순서)
  const { data: mentionMembers = [] } = useQuery({ queryKey: ["members", false], queryFn: () => listMembers(false) });
  const pageItem = spaceId === undefined ? null : pageSlashItem({
    editor: editor as unknown as Parameters<typeof pageSlashItem>[0]["editor"],
    spaceId,
    documentId,
    onCreated: (createdId) => {
      setScheduleError(null);
      void queryClient.invalidateQueries({ queryKey: ["documents", spaceId] });
      void queryClient.invalidateQueries({ queryKey: ["spaces"] });
      // 노션처럼 만든 페이지로 바로 이동하고 제목 칸에 커서 (넣은 페이지 블록이 협업 서버에 저장된 뒤)
      void openCreatedPage(() => waitUntilSynced(session.provider), navigate, createdId);
    },
    onError: setScheduleError,
  });

  // 블록 메뉴 "복제"로 페이지 블록을 복제할 때 페이지 사본을 만들고 목록 조회 갱신 (오류는 일정과 같은 안내 칸)
  const pageCopy: PageCopyActions = {
    copyPage: (id) => {
      setScheduleError(null);
      return duplicateDocument(id).then((created) => {
        void queryClient.invalidateQueries({ queryKey: ["documents", spaceId] });
        void queryClient.invalidateQueries({ queryKey: ["spaces"] });
        return created.id;
      });
    },
    onError: setScheduleError,
  };

  // 페이지 블록 복사·잘라내 붙여넣기 (editor/pagePaste): 잘라낸 것은 이 페이지 아래로 옮기고, 복사한 것은 이 페이지 아래에 사본
  useEffect(() => {
    if (!editable) return;
    const dom = editor.prosemirrorView?.dom;
    if (!dom) return;
    const selectedBlocks = () => editor.getSelection()?.blocks ?? [editor.getTextCursorPosition().block];
    const onCut = () => recordPageCut(documentId, pageIdsIn(selectedBlocks()));
    const onMarqueeCut = (event: Event) => {
      const ids = (event as CustomEvent<string[]>).detail;
      recordPageCut(documentId, pageIdsIn(ids.map((id) => editor.getBlock(id)).filter((b) => b !== undefined)));
    };
    dom.addEventListener("cut", onCut, true);
    dom.addEventListener("copy", clearPageCut, true);
    dom.addEventListener(BLOCKS_CUT_EVENT, onMarqueeCut);
    const refresh = (pageId: number) => refreshPageQueries(queryClient, pageId);
    // 지운 페이지 블록의 페이지는 휴지통으로, 되돌리기로 돌아온 블록의 페이지는 복원 (editor/pageRemoval)
    const removal = createPageRemovalTracker(documentId, {
      referencedIds: () => new Set(pageIdsIn(editor.document as never)),
      // 잘라내 붙여넣기를 기다리거나 다른 페이지로 옮겨 간 페이지는 휴지통으로 보내지 않음
      isCut: (pageId) => isPageCut(pageId) || isPageMoved(pageId),
      trashPage: (pageId) => deleteDocument(pageId).then(() => refresh(pageId)),
      restorePage: (pageId) => restoreDocument(pageId).then(() => refresh(pageId)),
      onError: setScheduleError,
    });
    const offChange = editor.onChange((_, { getChanges }) => {
      const changes = getChanges();
      // 다른 사람의 변경은 그 사람 화면에서 처리
      const local = changes.filter((c) => c.source.type !== "yjs-remote");
      removal.removed(pageIdsIn(local.filter((c) => c.type === "delete").map((c) => c.block)));
      removal.restored(pageIdsIn(local
        .filter((c) => c.type === "insert" && (c.source.type === "undo" || c.source.type === "redo" || c.source.type === "undo-redo"))
        .map((c) => c.block)));
      const pasted = changes.filter((c) => c.type === "insert" && c.source.type === "paste").map((c) => c.block);
      if (pasted.length === 0) return;
      setScheduleError(null);
      void adoptPastedPages(pasted, documentId, {
        movePage: (pageId, target) => moveDocument(pageId, target).then(() => refresh(pageId)),
        copyPage: (pageId, target) => duplicateDocument(pageId, target).then((created) => {
          refresh(created.id);
          return created.id;
        }),
        pointBlockTo: (blockId, newId) => {
          const block = editor.getBlock(blockId);
          if (block) editor.updateBlock(block, { props: { documentId: newId } } as never);
        },
        onError: setScheduleError,
      });
    });
    return () => {
      dom.removeEventListener("cut", onCut, true);
      dom.removeEventListener("copy", clearPageCut, true);
      dom.removeEventListener(BLOCKS_CUT_EVENT, onMarqueeCut);
      offChange?.();
      removal.dispose();
    };
  }, [editor, editable, documentId, queryClient]);

  // 블록을 다른 페이지로 옮기기 (블록 메뉴 "옮기기"로 고른 페이지, 페이지 블록 위에 끌어 놓은 페이지)
  // 대상 본문 맨 아래에 붙이고 이 본문에서는 지움, 블록 안의 페이지는 대상 페이지 아래로 (editor/blockMove)
  const [movingBlockIds, setMovingBlockIds] = useState<string[] | null>(null);
  const moveToPage = (blockIds: string[], target: { id: number; title?: string }) => {
    const pick = () => blockIds.map((id) => editor.getBlock(id)).filter((b) => b !== undefined);
    setScheduleError(null);
    moveBlocksToPage({ blocks: pick() as never, sourceDocumentId: documentId, targetDocumentId: target.id }, {
      movePage: (pageId, parentId) => moveDocument(pageId, parentId).then(() => refreshPageQueries(queryClient, pageId)),
      appendBlocks: appendBlocksToDocument,
      removeBlocks: () => editor.removeBlocks(pick()),
    })
      .then(() => {
        refreshPageQueries(queryClient, target.id);
        showToast(target.title ? `'${target.title}' 페이지로 옮겼습니다` : "페이지로 옮겼습니다");
      })
      .catch((error: unknown) =>
        setScheduleError(error instanceof Error && error.message ? error.message : "블록을 옮기지 못했습니다."));
  };
  const moveToPageRef = useRef(moveToPage);
  moveToPageRef.current = moveToPage;
  useEffect(() => {
    if (!editable) return;
    const dom = editor.prosemirrorView?.dom;
    if (!dom) return;
    const onOpenPicker = (event: Event) => setMovingBlockIds((event as CustomEvent<string[]>).detail);
    const onMoveInto = (event: Event) => {
      const { blockIds, targetDocumentId } = (event as CustomEvent<MoveIntoPageDetail>).detail;
      moveToPageRef.current(blockIds, { id: targetDocumentId });
    };
    dom.addEventListener(OPEN_MOVE_PICKER_EVENT, onOpenPicker);
    dom.addEventListener(MOVE_INTO_PAGE_EVENT, onMoveInto);
    return () => {
      dom.removeEventListener(OPEN_MOVE_PICKER_EVENT, onOpenPicker);
      dom.removeEventListener(MOVE_INTO_PAGE_EVENT, onMoveInto);
    };
  }, [editor, editable]);
  // 옮기는 블록 안의 페이지와 지금 페이지는 고를 수 없음
  const movingPageIds = new Set(movingBlockIds
    ? pageIdsIn(movingBlockIds.map((id) => editor.getBlock(id)).filter((b) => b !== undefined) as never)
    : []);

  // 예전 하위 페이지 트리의 항목을 본문 맨 끝에 페이지 블록으로 한 번만 붙임 (서버 목록은 처음 가져간 한 명만 받음)
  // 읽기 전용이면 가져가지 않아 다음에 편집 가능한 사람이 열 때 붙음
  const backfilled = useRef(false);
  useEffect(() => {
    if (!editable || spaceId === undefined || backfilled.current) return;
    backfilled.current = true;
    claimPageBlockBackfill(documentId)
      .then((ids) => {
        if (ids.length > 0) appendMissingPageBlocks(editor as unknown as PageEditor, ids);
      })
      .catch((error: unknown) => console.warn("기존 하위 페이지 블록을 붙이지 못했습니다.", error));
  }, [editable, spaceId, documentId, editor]);

  const [dropError, setDropError] = useState<string | null>(null);
  const hasFiles = (e: DragEvent) => editable && Array.from(e.dataTransfer.types).includes("Files");

  // 본문 아래 빈 곳에도 파일을 놓을 수 있게 허용
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (hasFiles(e)) e.preventDefault();
  };

  // 기본 드롭 처리 대신 떨어뜨린 위치에 여러 파일을 순서대로 넣고 동시에 업로드
  const onDropCapture = (e: DragEvent<HTMLDivElement>) => {
    const files = Array.from(e.dataTransfer.files);
    if (!hasFiles(e) || files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    // 편집기까지 이벤트가 가지 않아 남는 드롭 위치 표시줄 정리
    editor.prosemirrorView?.dom.dispatchEvent(new Event("dragleave"));
    setDropError(null);
    const target = dropTargetAt(e.currentTarget, e.clientX, e.clientY);
    void insertDroppedFiles(editor as unknown as DropEditor, files, target,
      (file) => uploadAttachment(documentId, file, true).then((a) => a.url))
      .then((failed) => {
        if (failed.length > 0) setDropError(`업로드하지 못한 파일: ${failed.join(", ")}`);
      });
  };

  // 마지막 블록보다 아래를 누르면 편집기보다 먼저 받아 마지막 빈 줄로 커서 이동, 그 위는 이미지 선택만 풀고 편집기에 넘김
  // (이미지가 마지막 블록이면 편집기·브라우저가 이미지를 다시 선택해 여러 번 눌러야 입력되던 문제)
  // 메뉴처럼 포털로 띄운 요소는 React 이벤트만 거쳐 오므로 실제 본문 영역 안을 누른 경우만 처리
  const onMouseDownCapture = (e: MouseEvent<HTMLDivElement>) => {
    if (!editable || e.button !== 0 || !e.currentTarget.contains(e.target as Node) || isInFloatingUi(e.target)) return;
    if (!isBelowLastBlock(e.currentTarget, e.clientY)) {
      releaseBlockSelection(editor as unknown as SelectionEditor, e.target as Element);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    focusEditorEnd(editor as unknown as EndEditor);
  };

  return (
    <Box ref={editorBoxRef} className="editor-drop-zone" onDragOver={onDragOver} onDropCapture={onDropCapture}
      onMouseDownCapture={onMouseDownCapture}>
      {dropError && <Alert color="red" mb="xs" withCloseButton onClose={() => setDropError(null)}>{dropError}</Alert>}
      {/* 블록 손잡이(⠿) 메뉴는 노션식 메뉴로 교체, 표는 행·열 손잡이만 두고 칸 모서리 메뉴 버튼은 숨김 */}
      {scheduleError && (
        <Alert color="red" mb="xs" withCloseButton onClose={() => setScheduleError(null)}>{scheduleError}</Alert>
      )}
      <BlockNoteView editor={editor} theme={colorScheme} sideMenu={false} tableHandles={false} slashMenu={false}
        formattingToolbar={false}>
        {/* 서식 도구 막대: 기본 버튼 + 노션처럼 코드(Ctrl+E)·서식 지우기 */}
        <NotionFormattingToolbarController />
        <PageCopyContext.Provider value={pageCopy}>
          <AlignedSideMenuController sideMenu={NotionSideMenu} />
        </PageCopyContext.Provider>
        <TableHandlesController tableCellHandle={HiddenCellButton} />
        {/* 여러 칸을 고르면 선택 범위 옆에 색·셀 병합·콘텐츠 삭제 메뉴 버튼 */}
        <CellSelectionMenu />
        {/* 기본 슬래시 메뉴에 "/콜아웃"(인용 아래), "/2단"·"/3단", "/페이지"·"/일정" 추가 */}
        <SuggestionMenuController
          triggerCharacter="/"
          shouldOpen={isOutsideTable}
          getItems={async (query) => filterSuggestionItems(
            [
              ...withCalloutItem(getDefaultReactSlashMenuItems(editor), calloutItem, ko.slash_menu.quote.title),
              ...(isInsideColumn(editor as unknown as Parameters<typeof isInsideColumn>[0]) ? [] : columnItems),
              ...(pageItem === null ? [] : [pageItem, scheduleItem]),
            ],
            query,
          )}
        />
        {/* @ 입력 시 활성 팀원 목록, 고르면 @멘션을 넣고 그 팀원에게 담당 언급 알림 */}
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async (query) => filterMentionCandidates(mentionMembers, query).map((member) => ({
            title: member.name,
            subtext: [member.department, member.jobRank && JOB_RANKS.find((rank) => rank.value === member.jobRank)?.label]
              .filter(Boolean).join(" · ") || undefined,
            onItemClick: () => editor.insertInlineContent([
              { type: "mention", props: { memberId: member.id, name: member.name } }, " ",
            ]),
          }))}
        />
      </BlockNoteView>
      {/* 블록 메뉴 "옮기기": 검색 창과 같은 모양으로 옮길 페이지를 고름 */}
      <SearchDialog
        opened={movingBlockIds !== null}
        onClose={() => setMovingBlockIds(null)}
        pick={movingBlockIds === null ? undefined : {
          placeholder: "옮길 페이지 검색",
          actionLabel: "옮기기",
          exclude: (doc) => doc.id === documentId || movingPageIds.has(doc.id),
          onPick: (doc) => moveToPage(movingBlockIds, { id: doc.id, title: doc.title }),
        }}
      />
      {/* 본문 아래 빈 곳 (누르면 위 onMouseDownCapture가 마지막 빈 줄로 커서 이동) */}
      {editable && <div className="editor-end-filler" aria-hidden />}
    </Box>
  );
}
