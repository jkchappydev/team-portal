import { AppShell } from "@mantine/core";
import { Outlet } from "react-router-dom";
import { useCurrentUser } from "../user/currentUser";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { user } = useCurrentUser();
  return <AppShell navbar={{ width: 260, breakpoint: "sm" }} padding="md">
    <AppShell.Navbar><Sidebar user={user} /></AppShell.Navbar>
    <AppShell.Main>{user && <Outlet />}</AppShell.Main>
  </AppShell>;
}
