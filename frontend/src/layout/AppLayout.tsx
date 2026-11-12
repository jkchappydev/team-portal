import { useLayoutEffect, useRef } from "react";
import { AppShell, Box } from "@mantine/core";
import { Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../user/currentUser";
import { Sidebar } from "./Sidebar";
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
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main || prefersReducedMotion() || typeof main.animate !== "function") return;
    main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: PAGE_FADE_MS, easing: "ease-out" });
  }, [pathname]);
  return <AppShell navbar={{ width: 260, breakpoint: "sm" }} padding="md">
    <AppShell.Navbar><Sidebar user={user} /></AppShell.Navbar>
    <AppShell.Main>
      {/* 메뉴 화면은 위쪽도 왼쪽과 같은 여백 */}
      {user && <Box ref={mainRef} px={ownPadding ? 0 : { base: 0, sm: 24 }} pt={ownPadding ? 0 : { base: 0, sm: 24 }}><Outlet /></Box>}
    </AppShell.Main>
  </AppShell>;
}
