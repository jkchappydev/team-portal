import { useState } from "react";
import type { ReactNode } from "react";
import { Box, Button, Group, Popover, Text } from "@mantine/core";
import { ImageUpload } from "./IconPicker";

interface Props {
  // 선택 창을 여는 버튼
  target: (toggle: () => void) => ReactNode;
  // 현재 커버가 있을 때만 제거 버튼 표시
  hasCover: boolean;
  // 업로드 이미지를 붙일 프로젝트 본문 페이지
  documentId: number;
  // null이면 커버 제거
  onSelect: (cover: string | null) => void;
}

// 프로젝트 커버 선택 창: 아이콘 업로드와 같은 방식(파일 선택·끌어다 놓기·붙여넣기·https 주소)
export function CoverPicker({ target, hasCover, documentId, onSelect }: Props) {
  const [opened, setOpened] = useState(false);

  const select = (cover: string | null) => {
    onSelect(cover);
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={360} shadow="md" withinPortal>
      <Popover.Target>{target(() => setOpened((v) => !v))}</Popover.Target>
      <Popover.Dropdown p={0}>
        <Group justify="space-between" wrap="nowrap" px="xs" py={6}
          style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
          <Text size="sm" fw={500}>커버</Text>
          {hasCover && (
            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => select(null)}>제거</Button>
          )}
        </Group>
        <Box>
          {opened && <ImageUpload documentId={documentId} onDone={select} onCancel={() => setOpened(false)} />}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
