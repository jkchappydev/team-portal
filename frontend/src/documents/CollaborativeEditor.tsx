import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useState } from "react";
import type { DragEvent } from "react";
import { Alert, Badge, Box, Button, Group, Loader, Text, useComputedColorScheme } from "@mantine/core";
import { ko } from "@blocknote/core/locales";
import { withCollaboration } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/mantine";
import { SideMenu, SideMenuController, TableHandlesController, useCreateBlockNote } from "@blocknote/react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { uploadAttachment } from "../api/attachments";
import { fetchCollabTicket } from "../api/collab";
import type { MemberDto } from "../api/members";
import { collabUrl, FRAGMENT_NAME } from "./collab";
import { NotionDragHandleMenu } from "./editor/NotionDragHandleMenu";
import { dropTargetAt, insertDroppedFiles } from "./fileDrop";
import type { DropEditor } from "./fileDrop";
import { userColor } from "./userColor";


interface Props {
  documentId: number;
  user: MemberDto;
}

interface Session {
  doc: Y.Doc;
  provider: HocuspocusProvider;
}


// 문서가 바뀌면 상위에서 key로 다시 마운트하므로 상태 초기화는 마운트 단위로 처리
export default function CollaborativeEditor({ documentId, user }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [connected, setConnected] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [unsynced, setUnsynced] = useState(false);

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

    return () => {
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
}

function EditorView({ session, documentId, user, editable }: EditorViewProps) {
  // 편집기 테마를 앱의 라이트/다크 설정에 맞춤
  const colorScheme = useComputedColorScheme("light");
  const editor = useCreateBlockNote(
    withCollaboration({
      dictionary: ko,
      collaboration: {
        provider: { awareness: session.provider.awareness ?? undefined },
        fragment: session.doc.getXmlFragment(FRAGMENT_NAME),
        user: { name: user.name, color: userColor(user.id) },
      },
      // 본문에 넣는 파일은 inline 첨부로 업로드 후 다운로드 URL 사용
      uploadFile: (file: File) => uploadAttachment(documentId, file, true).then((a) => a.url),
      // 블록 이동 시 놓일 위치 표시줄 (기본 5px은 두꺼워 2px로 축소)
      dropCursor: { width: 2, color: "var(--mantine-primary-color-filled)" },
      // 노션처럼 표의 행·열 색칠(배경·글자), 첫 행·첫 열 머리글, 셀 병합·분할 허용
      tables: { cellBackgroundColor: true, cellTextColor: true, headers: true, splitCells: true },
    }),
    [session, documentId, user.id, user.name],
  );

  // editable prop은 뷰를 다시 마운트하므로 편집기 인스턴스 상태만 전환
  useEffect(() => {
    setEditorEditable(editor, editable);
  }, [editor, editable]);

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

  return (
    <Box className="editor-drop-zone" onDragOver={onDragOver} onDropCapture={onDropCapture}>
      {dropError && <Alert color="red" mb="xs" withCloseButton onClose={() => setDropError(null)}>{dropError}</Alert>}
      {/* 블록 손잡이(⠿) 메뉴는 노션식 메뉴로 교체, 표는 행·열 손잡이만 두고 칸 모서리 메뉴 버튼은 숨김 */}
      <BlockNoteView editor={editor} theme={colorScheme} sideMenu={false} tableHandles={false}>
        <SideMenuController sideMenu={(props) => <SideMenu {...props} dragHandleMenu={NotionDragHandleMenu} />} />
        <TableHandlesController tableCellHandle={HiddenCellButton} />
      </BlockNoteView>
    </Box>
  );
}
