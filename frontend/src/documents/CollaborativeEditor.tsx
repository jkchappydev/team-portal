import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { useEffect, useState } from "react";
import { Alert, Badge, Box, Button, Group, Loader, Text } from "@mantine/core";
import { ko } from "@blocknote/core/locales";
import { withCollaboration } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { uploadAttachment } from "../api/attachments";
import type { MemberDto } from "../api/members";
import { userColor } from "./userColor";

// BlockNote가 협업 본문을 저장하는 Yjs 조각 이름 (collab 서버 텍스트 추출과 동일)
const FRAGMENT_NAME = "document-store";

interface Props {
  documentId: number;
  user: MemberDto;
}

interface Session {
  doc: Y.Doc;
  provider: HocuspocusProvider;
}

function collabUrl(): string {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${location.host}/collab`;
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
      token: String(user.id),
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
      <Group gap="xs" mb={6}>
        {authFailed ? (
          <Badge color="red" variant="light" size="sm">접속 거부됨</Badge>
        ) : (
          <Badge color={connected ? "green" : "yellow"} variant="dot" size="sm">
            {connected ? "연결됨" : "재연결 중"}
          </Badge>
        )}
        {!authFailed && !connected && session && (
          <Text size="xs" c="dimmed">연결이 끊겨 읽기 전용입니다. 다시 연결되면 편집할 수 있습니다.</Text>
        )}
      </Group>
      {/* backend 일시 장애 등으로 접속이 거부되면 provider가 재시도하지 않으므로 새로고침 안내 */}
      {authFailed && (
        <Alert color="red" variant="light" mb="sm" title="문서에 접속하지 못했습니다">
          <Text size="sm" mb="xs">서버가 잠시 응답하지 않았을 수 있습니다. 잠시 후 새로고침하세요.</Text>
          <Button size="xs" variant="light" color="red" onClick={() => window.location.reload()}>새로고침</Button>
        </Alert>
      )}
      {session ? (
        <EditorView key={`${documentId}-${user.id}`} session={session} documentId={documentId} user={user} editable={editable} />
      ) : authFailed ? null : (
        <Group gap="xs" p="md">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">문서를 불러오는 중...</Text>
        </Group>
      )}
    </Box>
  );
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
    }),
    [session, documentId, user.id, user.name],
  );

  // editable prop은 뷰를 다시 마운트하므로 편집기 인스턴스 상태만 전환
  useEffect(() => {
    setEditorEditable(editor, editable);
  }, [editor, editable]);

  return <BlockNoteView editor={editor} theme="light" />;
}
