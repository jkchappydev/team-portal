import { Button, Center, Stack, Text, Title } from "@mantine/core";

// 상태 코드별 기본 제목 (화면마다 같은 문구를 쓰도록 한곳에서 관리)
export const ERROR_TITLES: Record<string, string> = {
  "400": "잘못된 요청입니다",
  "403": "접근 권한이 없습니다",
  "404": "페이지를 찾을 수 없습니다",
  "500": "오류가 발생했습니다",
  "502": "서버를 준비하는 중입니다",
  "503": "서버를 준비하는 중입니다",
  "504": "서버를 준비하는 중입니다",
  "Network Error": "서버에 연결하지 못했습니다",
};

export function errorTitle(code: string): string {
  return ERROR_TITLES[code] ?? "오류가 발생했습니다";
}

// 오류 코드를 크게 보여주는 공통 오류 페이지
// 포털 틀 안(사이드바 옆)에 그릴 때는 inLayout으로 높이를 줄임
export function ErrorPage({ code, title = errorTitle(code), actionLabel, onAction, loading = false, inLayout = false }: {
  code: string;
  inLayout?: boolean;
  title?: string;
  actionLabel: string;
  onAction: () => void;
  loading?: boolean;
}) {
  return (
    <Center mih={inLayout ? "70vh" : "100vh"} p="md">
      <Stack gap="xs" align="center">
        <Text fz={code.length > 3 ? 40 : 96} fw={700} lh={1} c="dimmed">{code}</Text>
        <Title order={3} ta="center" mt="md">{title}</Title>
        <Button variant="default" radius="md" mt="lg" loading={loading} onClick={onAction}>{actionLabel}</Button>
      </Stack>
    </Center>
  );
}
