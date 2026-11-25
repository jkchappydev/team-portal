import { Box, Button, Group, Modal, Stack, Text, UnstyledButton } from "@mantine/core";
import type { LinkDto } from "../api/links";
import { copyText } from "../documents/clipboard";
import { showToast } from "../toast/toastStore";
import { ExternalLinkIcon, LinkIcon } from "./SidebarIcons";
import { useLastValue } from "./useLastValue";

interface Props {
  // 보여 줄 링크 (null이면 닫힘)
  link: LinkDto | null;
  onClose: () => void;
}

// 사이드바 링크를 눌렀을 때 뜨는 팝업 (링크 이동 + 계정 정보, 계정 정보가 없으면 없다고 안내)
export function LinkInfoDialog({ link, onClose }: Props) {
  // 닫히는 동안에도 내용을 유지 (바로 지우면 창이 빈 채로 줄어들며 사라짐)
  const shown = useLastValue(link);
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
      {shown && <LinkInfoBody link={shown} onClose={onClose} />}
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
      {/* 고른 아이콘이 없으면 사이드바와 같은 선 아이콘 */}
      <Group gap={8} wrap="nowrap" px="lg" pt="lg" pb="md">
        {link.icon ? <span aria-hidden>{link.icon}</span> : <LinkIcon />}
        <Text fw={600} fz="md" truncate style={{ minWidth: 0 }}>{link.title}</Text>
      </Group>
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
              <Box style={{ display: "flex", flexShrink: 0 }}><LinkIcon /></Box>
              <Text size="sm" c="blue" truncate style={{ flex: 1, minWidth: 0 }}>{link.url}</Text>
              <Box style={{ display: "flex", flexShrink: 0 }}><ExternalLinkIcon /></Box>
            </Group>
          </UnstyledButton>
        </Stack>
        <Stack gap={6}>
          <Group justify="space-between" gap="xs">
            <Text size="sm" fw={500}>계정 정보</Text>
            {link.accountInfo && <Button size="compact-xs" variant="subtle" onClick={copyAccount}>복사</Button>}
          </Group>
          {/* 계정 정보가 없어도 같은 회색 상자 안에 흐린 글자로 안내 */}
          <Text
            size="sm"
            px="sm"
            py="xs"
            c={link.accountInfo ? undefined : "dimmed"}
            aria-label="계정 정보 내용"
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              borderRadius: "var(--mantine-radius-sm)",
              border: "1px solid var(--mantine-color-default-border)",
              background: "var(--mantine-color-default-hover)",
            }}
          >
            {link.accountInfo || "등록된 계정 정보가 없습니다."}
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
