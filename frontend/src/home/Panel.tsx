import type { ReactNode } from "react";
import { Group, Paper, Title } from "@mantine/core";

// 메인 화면 칸 하나 (제목 + 오른쪽 바로가기 + 내용)
export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md" component="section" aria-label={title}>
      <Group justify="space-between" mb="sm">
        <Title order={5}>{title}</Title>
        {action}
      </Group>
      {children}
    </Paper>
  );
}
