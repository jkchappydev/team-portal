import { Stack, Text, Title } from "@mantine/core";

// 주소록: 메뉴만 먼저 두고 화면은 아직 미구현
export function ContactsPage() {
  return (
    <Stack gap="xs">
      <Title order={2}>주소록</Title>
      <Text c="dimmed">기능 미구현</Text>
    </Stack>
  );
}
