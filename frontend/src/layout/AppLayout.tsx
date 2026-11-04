import { useState } from "react";
import { AppShell } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Outlet } from "react-router-dom";
import { listMembers } from "../api/members";
import { MemberSelectDialog } from "../user/MemberSelectDialog";
import { useCurrentUser } from "../user/currentUser";
import { Sidebar } from "./Sidebar";

export function AppLayout() {
  const { user, select, clear } = useCurrentUser();
  const { isPending } = useQuery({ queryKey: ["members", false], queryFn: () => listMembers(false) });
  // 변경 버튼으로 직접 열었을 때도 선택 창 표시
  const [changing, setChanging] = useState(false);
  const needsSelection = user === null && !isPending;

  return (
    <AppShell navbar={{ width: 260, breakpoint: "sm" }} padding="md">
      <AppShell.Navbar>
        <Sidebar
          user={user}
          onChangeUser={() => {
            clear();
            setChanging(true);
          }}
        />
      </AppShell.Navbar>
      <AppShell.Main>{user && <Outlet />}</AppShell.Main>
      <MemberSelectDialog
        opened={needsSelection || changing}
        onSelect={(id) => {
          select(id);
          setChanging(false);
        }}
      />
    </AppShell>
  );
}
