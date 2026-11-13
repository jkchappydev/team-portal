import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { Alert, Badge, Box, Button, Group, Loader, Text, useComputedColorScheme } from "@mantine/core";
import { ko } from "@blocknote/core/locales";
import { withCollaboration } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/mantine";
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core";
import { isOutsideTable, NEW_CALLOUT, withCalloutItem } from "./editor/calloutCommand";
import { AlignedSideMenuController } from "./editor/AlignedSideMenuController";
import { syntaxHighlighter } from "@blocknote/code-block";
import { pasteOptions } from "./editor/paste";
import { yUndoPluginKey } from "y-prosemirror";
import { reviveUndoManager } from "./editor/undoRevive";
import { NotionFormattingToolbar } from "./editor/formattingToolbar";
import { FORMAT_SHORTCUTS, formatShortcutsExtension } from "./editor/formatShortcuts";
import { activeTableCellExtension } from "./editor/activeTableCell";
import { tableHandleDragExtension } from "./editor/tableHandleDrag";
import { checkListAnimationExtension } from "./editor/checkListAnimation";
import { blockDropExtension, notionDropCursor } from "./editor/blockDrop";
import { calloutBackspaceExtension } from "./editor/calloutBackspace";
import { installBlockMarquee } from "./editor/blockMarquee";
import {
  FormattingToolbarController, getDefaultReactSlashMenuItems, SuggestionMenuController, TableHandlesController,
  useCreateBlockNote,
} from "@blocknote/react";
import type { DefaultReactSuggestionItem } from "@blocknote/react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { createDocument } from "../api/documents";
import { placeScheduleBlock } from "./editor/scheduleCommand";
import type { ScheduleEditor } from "./editor/scheduleCommand";
import { editorSchema } from "./editor/schema";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { uploadAttachment } from "../api/attachments";
import { fetchCollabTicket } from "../api/collab";
import type { MemberDto } from "../api/members";
import { collabUrl, FRAGMENT_NAME } from "./collab";
import { createCursorActivity, editingClientIds, renderCursor } from "./cursorActivity";
import type { CursorUser } from "./cursorActivity";
import { NotionSideMenu } from "./editor/NotionSideMenu";
import { CellSelectionMenu } from "./editor/CellSelectionMenu";
import { sameViewers, viewersOf } from "./presence";
import type { PresenceUser, Viewer } from "./presence";
import { dropTargetAt, insertDroppedFiles } from "./fileDrop";
import type { DropEditor } from "./fileDrop";
import { focusEditorEnd, isBelowLastBlock, releaseBlockSelection } from "./editorEnd";
import type { EndEditor, SelectionEditor } from "./editorEnd";
import { userColor } from "./userColor";


interface Props {
  documentId: number;
  user: MemberDto;
  // 슬래시 메뉴 "/일정"으로 이 페이지 아래에 WBS를 만들 최상위 페이지 (없으면 메뉴에서 제외)
  scheduleSpaceId?: number;
  // 지금 이 페이지를 보고 있는 사람(나 포함) 목록이 바뀔 때 알림
  onViewersChange?: (viewers: Viewer[]) => void;
}

interface Session {
  doc: Y.Doc;
  provider: HocuspocusProvider;
}


// 문서가 바뀌면 상위에서 key로 다시 마운트하므로 상태 초기화는 마운트 단위로 처리
export default function CollaborativeEditor({ documentId, user, scheduleSpaceId, onViewersChange }: Props) {
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
          <Button size="xs" variant="light" color="red" onClick={() => window.location.reload()}>새로고침</Button>
        </Alert>
      )}
      {session ? (
        <EditorView
          key={`${documentId}-${user.id}`}
          session={session}
          documentId={documentId}
          user={user}
          editable={editable}
          scheduleSpaceId={scheduleSpaceId}
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

// BlockNote 편집기는 외부 가변 객체이고 isEditable 세터가 공식 잠금 API
function setEditorEditable(editor: { isEditable: boolean }, editable: boolean): void {
  editor.isEditable = editable;
}

interface EditorViewProps {
  session: Session;
  documentId: number;
  user: MemberDto;
  editable: boolean;
  scheduleSpaceId?: number;
}

function EditorView({ session, documentId, user, editable, scheduleSpaceId }: EditorViewProps) {
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
      // 서식(HTML)이 함께 오면 항상 HTML로 붙여넣음 (노션 표가 마크다운 오인으로 글 한 덩어리가 되는 문제)
      pasteHandler: ({ event, defaultPasteHandler }) =>
        defaultPasteHandler(pasteOptions(Array.from(event.clipboardData?.types ?? []))),
      // 코드 블록 문법 색칠 (언어별 문법은 필요할 때 불러옴)
      extensions: [syntaxHighlighter, formatShortcutsExtension, activeTableCellExtension, tableHandleDragExtension,
        checkListAnimationExtension, blockDropExtension(), calloutBackspaceExtension],
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
    icon: <span aria-hidden>💡</span>,
    onItemClick: () => {
      const callout = insertOrUpdateBlockForSlashMenu(editor, NEW_CALLOUT);
      if (callout.children[0]) editor.setTextCursorPosition(callout.children[0], "start");
    },
  };

  const scheduleItem: DefaultReactSuggestionItem = {
    title: "일정",
    subtext: "WBS 표와 간트 차트",
    aliases: ["일정", "wbs", "schedule", "간트", "gantt"],
    group: "기타",
    icon: <span aria-hidden>📊</span>,
    onItemClick: () => {
      if (scheduleSpaceId === undefined) return;
      const block = editor.getTextCursorPosition().block;
      setScheduleError(null);
      createDocument(scheduleSpaceId, documentId, "일정", "WBS")
        .then((created) => {
          void queryClient.invalidateQueries({ queryKey: ["documents", scheduleSpaceId] });
          void queryClient.invalidateQueries({ queryKey: ["spaces"] });
          placeScheduleBlock(editor as unknown as ScheduleEditor, block, created.id);
        })
        .catch((error: unknown) => setScheduleError(error instanceof ApiError ? error.message : "일정을 만들지 못했습니다."));
    },
  };

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
    if (!editable || e.button !== 0 || !e.currentTarget.contains(e.target as Node)) return;
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
        <FormattingToolbarController formattingToolbar={NotionFormattingToolbar} />
        <AlignedSideMenuController sideMenu={NotionSideMenu} />
        <TableHandlesController tableCellHandle={HiddenCellButton} />
        {/* 여러 칸을 고르면 선택 범위 옆에 색·셀 병합·콘텐츠 삭제 메뉴 버튼 */}
        <CellSelectionMenu />
        {/* 기본 슬래시 메뉴에 "/콜아웃"(인용 아래)과 "/일정" 추가 */}
        <SuggestionMenuController
          triggerCharacter="/"
          shouldOpen={isOutsideTable}
          getItems={async (query) => filterSuggestionItems(
            [
              ...withCalloutItem(getDefaultReactSlashMenuItems(editor), calloutItem, ko.slash_menu.quote.title),
              ...(scheduleSpaceId === undefined ? [] : [scheduleItem]),
            ],
            query,
          )}
        />
      </BlockNoteView>
      {/* 본문 아래 빈 곳 (누르면 위 onMouseDownCapture가 마지막 빈 줄로 커서 이동) */}
      {editable && <div className="editor-end-filler" aria-hidden />}
    </Box>
  );
}
