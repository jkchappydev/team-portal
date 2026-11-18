import { useState } from "react";
import { Alert, Button, Group, Modal, Radio, Stack } from "@mantine/core";
import type { SpaceKind } from "../api/spaces";

// 라디오 동그라미와 글자 모두 누를 수 있는 모양으로
const POINTER_RADIO = { radio: { cursor: "pointer" }, label: { cursor: "pointer" }, description: { cursor: "pointer" } };

interface Props {
  opened: boolean;
  pending: boolean;
  // 만들기 실패 메시지 (없으면 미표시)
  error?: string | null;
  // 창 제목 (어느 칸에 만드는지, 없으면 "새로 만들기")
  title?: string;
  onClose: () => void;
  onCreate: (kind: SpaceKind) => void;
}

// 사이드바 "+ 새로 만들기": 프로젝트(메인 화면 갤러리에 보임)와 페이지 중 골라 최상위에 만듦
export function CreateSpaceModal({ opened, pending, error, title = "새로 만들기", onClose, onCreate }: Props) {
  const [kind, setKind] = useState<SpaceKind>("PROJECT");
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="sm">
      <Stack>
        <Radio.Group value={kind} onChange={(value) => setKind(value as SpaceKind)} aria-label="만들 종류">
          <Stack gap="sm">
            <Radio value="PROJECT" label="프로젝트" description="메인 화면 프로젝트 목록에 보입니다." styles={POINTER_RADIO} />
            <Radio value="PAGE" label="페이지" styles={POINTER_RADIO} />
          </Stack>
        </Radio.Group>
        {error && <Alert color="red">{error}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} style={{ cursor: "pointer" }}>취소</Button>
          {/* 창이 열리면 만들기 버튼에 포커스가 있어 Enter로 바로 만듦 */}
          <Button loading={pending} onClick={() => onCreate(kind)} data-autofocus style={{ cursor: "pointer" }}>만들기</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
