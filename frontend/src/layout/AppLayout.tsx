import { AppShell, Box } from "@mantine/core";
import { Outlet, useLocation } from "react-router-dom";
import { useCurrentUser } from "../user/currentUser";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { user } = useCurrentUser();
  const { pathname } = useLocation();
  // 페이지·파일·일정 화면은 자체 좌우 여백이 있어 그대로 두고, 나머지 메뉴 화면은 사이드바와 좌우·위쪽 여백을 더 둠
  const ownPadding = /^\/(documents|files|wbs|spaces)\//.test(pathname);
  return <AppShell navbar={{ width: 260, breakpoint: "sm" }} padding="md">
    <AppShell.Navbar><Sidebar user={user} /></AppShell.Navbar>
    <AppShell.Main>
      {/* 메뉴 화면은 위쪽도 왼쪽과 같은 여백 */}
      {user && <Box px={ownPadding ? 0 : { base: 0, sm: 24 }} pt={ownPadding ? 0 : { base: 0, sm: 24 }}><Outlet /></Box>}
    </AppShell.Main>
  </AppShell>;
}
