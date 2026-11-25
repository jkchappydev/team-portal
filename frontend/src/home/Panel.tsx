import type { ReactNode } from "react";
import { Group, Paper, Title } from "@mantine/core";

// 메인 화면 칸 하나 (제목 + 오른쪽 바로가기 + 내용, 같은 줄의 칸끼리 높이를 맞춤)
export function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper withBorder radius={10} px={20} py={18} h="100%" component="section" aria-label={title}>
      <Group justify="space-between" mb="sm">
        <Title order={2} fz={15} fw={600}>{title}</Title>
        {action}
      </Group>
      {children}
    </Paper>
  );
}
