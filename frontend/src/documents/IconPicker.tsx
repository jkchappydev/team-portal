import { useState } from "react";
import type { ReactNode } from "react";
import { Box, Button, Group, Popover, Text, TextInput, UnstyledButton } from "@mantine/core";
import { ICON_GROUPS, randomIcon } from "./pageIcon";

interface Props {
  // 선택 창을 여는 버튼
  target: (toggle: () => void) => ReactNode;
  // 현재 아이콘이 있을 때만 제거 버튼 표시
  hasIcon: boolean;
  // null이면 아이콘 제거
  onSelect: (icon: string | null) => void;
}

// 노션처럼 이모지 묶음에서 고르거나 직접 붙여넣는 아이콘 선택 창
export function IconPicker({ target, hasIcon, onSelect }: Props) {
  const [opened, setOpened] = useState(false);
  const [custom, setCustom] = useState("");

  const select = (icon: string | null) => {
    onSelect(icon);
    setOpened(false);
    setCustom("");
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={340} shadow="md" withinPortal>
      <Popover.Target>{target(() => setOpened((v) => !v))}</Popover.Target>
      <Popover.Dropdown p="xs">
        <Group gap="xs" mb="xs" wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="이모지 붙여넣기"
            aria-label="이모지 직접 입력"
            value={custom}
            maxLength={16}
            onChange={(e) => setCustom(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) {
                e.preventDefault();
                select(custom.trim());
              }
            }}
            style={{ flex: 1 }}
          />
          <Button size="xs" variant="default" onClick={() => select(randomIcon())}>랜덤</Button>
          {hasIcon && (
            <Button size="xs" variant="subtle" color="red" onClick={() => select(null)}>제거</Button>
          )}
        </Group>
        <Box mah={300} style={{ overflowY: "auto" }}>
          {ICON_GROUPS.map((group) => (
            <Box key={group.label} mb={6}>
              <Text size="xs" c="dimmed" mb={2}>{group.label}</Text>
              <Box style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 2 }}>
                {group.icons.map((icon) => (
                  <UnstyledButton
                    key={icon}
                    aria-label={`아이콘 ${icon}`}
                    onClick={() => select(icon)}
                    className="page-row"
                    style={{ fontSize: 22, lineHeight: "34px", textAlign: "center", borderRadius: 6 }}
                  >
                    {icon}
                  </UnstyledButton>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Popover.Dropdown>
    </Popover>
  );
}
