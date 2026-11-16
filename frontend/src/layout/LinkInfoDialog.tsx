import { Box, Button, Group, Modal, Stack, Text, UnstyledButton } from "@mantine/core";
import type { LinkDto } from "../api/links";
import { copyText } from "../documents/clipboard";
import { showToast } from "../toast/toastStore";
import { LinkIcon } from "./LinkDialog";

interface Props {
  // 보여 줄 링크 (null이면 닫힘)
  link: LinkDto | null;
  onClose: () => void;
}

// 계정 정보가 있는 사이드바 링크를 눌렀을 때 뜨는 팝업 (링크 이동 + 계정 정보)
export function LinkInfoDialog({ link, onClose }: Props) {
  return (
    <Modal
      opened={link !== null}
      onClose={onClose}
      withCloseButton={false}
      centered
      size={440}
      padding={0}
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.35 }}
      returnFocus={false}
    >
      {link && <LinkInfoBody link={link} onClose={onClose} />}
    </Modal>
  );
}

function LinkInfoBody({ link, onClose }: { link: LinkDto; onClose: () => void }) {
  const copyAccount = () => {
    copyText(link.accountInfo ?? "")
      .then(() => showToast("계정 정보를 복사했습니다"))
      .catch(() => showToast("계정 정보를 복사하지 못했습니다"));
  };
  return (
    <>
      <Text fw={600} fz="md" px="lg" pt="lg" pb="md" truncate>
        <span aria-hidden>{link.icon ?? "🔗"}</span> {link.title}
      </Text>
      <Stack gap="md" px="lg" pb="lg">
        <Stack gap={6}>
          <Text size="sm" fw={500}>링크 이동</Text>
          {/* 누르면 새 탭으로 열고 팝업은 닫음 */}
          <UnstyledButton
            component="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="링크 이동"
            className="link-info-go"
            onClick={onClose}
          >
            <Group gap={8} wrap="nowrap">
              <Box c="dimmed" style={{ display: "flex", flexShrink: 0 }}><LinkIcon /></Box>
              <Text size="sm" c="blue" truncate style={{ flex: 1, minWidth: 0 }}>{link.url}</Text>
              <Text size="sm" c="dimmed" aria-hidden>↗</Text>
            </Group>
          </UnstyledButton>
        </Stack>
        <Stack gap={6}>
          <Group justify="space-between" gap="xs">
            <Text size="sm" fw={500}>계정 정보</Text>
            <Button size="compact-xs" variant="subtle" onClick={copyAccount}>복사</Button>
          </Group>
          <Text
            size="sm"
            px="sm"
            py="xs"
            aria-label="계정 정보 내용"
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              borderRadius: "var(--mantine-radius-sm)",
              border: "1px solid var(--mantine-color-default-border)",
              background: "var(--mantine-color-default-hover)",
            }}
          >
            {link.accountInfo}
          </Text>
        </Stack>
      </Stack>
      <Group
        justify="flex-end"
        gap="xs"
        px="lg"
        py="sm"
        bg="var(--mantine-color-default-hover)"
        style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
      >
        <Button variant="default" onClick={onClose}>닫기</Button>
      </Group>
    </>
  );
}
