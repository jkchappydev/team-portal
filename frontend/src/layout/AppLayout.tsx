import { useEffect, useLayoutEffect, useRef } from "react";
import { ActionIcon, AppShell, Box, Group, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../user/currentUser";
import { Sidebar } from "./Sidebar";
import { NewCsToasts } from "../home/NewCsToasts";
import { prefersReducedMotion } from "./reorderAnimation";

// 다른 화면으로 옮길 때 본문이 옅게 나타나는 시간 (길면 오히려 느려 보여 짧게)
const PAGE_FADE_MS = 120;

export function AppLayout() {
  const { user } = useCurrentUser();
  const { pathname } = useLocation();
  // 페이지·파일·일정 화면은 자체 좌우 여백이 있어 그대로 두고, 나머지 메뉴 화면은 사이드바와 좌우·위쪽 여백을 더 둠
  const ownPadding = /^\/(documents|files|wbs|spaces)\//.test(pathname);
  // 주소가 바뀌면 본문을 다시 만들지 않고 투명도만 0에서 1로 (사이드바는 그대로)
  const mainRef = useRef<HTMLDivElement>(null);
  // 좁은 화면(sm 미만)은 사이드바를 닫아 두고 위쪽 메뉴 버튼으로 열고 닫음
  const [navOpened, { toggle: toggleNav, close: closeNav }] = useDisclosure(false);
  // 다른 화면으로 옮기면 열린 사이드바를 닫아 본문이 보이게 함
  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main || prefersReducedMotion() || typeof main.animate !== "function") return;
    main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: PAGE_FADE_MS, easing: "ease-out" });
  }, [pathname]);
  return <AppShell
    header={{ height: { base: 48, sm: 0 } }}
    navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !navOpened } }}
    padding="md">
    {/* 좁은 화면 전용 위쪽 줄 (넓은 화면은 높이 0으로 숨김) */}
    <AppShell.Header hiddenFrom="sm">
      <Group h="100%" px="md" gap="sm" wrap="nowrap">
        {/* 닫힘 ☰, 열림 « (모양 전환 애니메이션 없이 바로 바뀜, 사이드바 펼침 애니메이션은 AppShell 기본 그대로) */}
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={toggleNav} aria-label={navOpened ? "메뉴 닫기" : "메뉴 열기"}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}
            strokeLinecap="round" strokeLinejoin="round">
            <path d={navOpened ? "M10 5 5 10l5 5 M15 5l-5 5 5 5" : "M3.5 5.5h13 M3.5 10h13 M3.5 14.5h13"} />
          </svg>
        </ActionIcon>
        <Text fw={700} truncate>개발팀</Text>
      </Group>
    </AppShell.Header>
    <AppShell.Navbar><Sidebar user={user} /></AppShell.Navbar>
    <AppShell.Main>
      {/* 메뉴 화면은 위쪽도 왼쪽과 같은 여백 */}
      {user && <Box ref={mainRef} px={ownPadding ? 0 : { base: 0, sm: 24 }} pt={ownPadding ? 0 : { base: 0, sm: 24 }}><Outlet /></Box>}
      {/* 새로 접수된 CS 토스트 (모든 화면) */}
      {user && <NewCsToasts />}
    </AppShell.Main>
  </AppShell>;
}
