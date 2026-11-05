import type { ReactNode } from "react";
import { Box, NavLink } from "@mantine/core";
import { NavLink as RouterLink, useLocation } from "react-router-dom";

interface Props {
  label: string;
  icon: ReactNode;
  // 이동할 주소 (없으면 onClick만 실행하는 메뉴)
  to?: string;
  onClick?: () => void;
  rightSection?: ReactNode;
}

// 사이드바 고정 메뉴(검색·근무 상황표·휴지통)를 페이지 트리 줄과 같은 높이·아이콘 칸으로 표시
export function SidebarMenuLink({ label, icon, to, onClick, rightSection }: Props) {
  const location = useLocation();
  const common = {
    label,
    py: 4,
    pl: 6,
    // 오른쪽 표시(단축키 등)가 있으면 줄 오른쪽 끝에 붙임
    pr: rightSection ? 4 : undefined,
    leftSection: <Box className="tree-slot" w={22} h={22}>{icon}</Box>,
    rightSection,
    // 아이콘과 글자 사이 간격(페이지 트리 줄과 같은 6px)은 CSS에서 왼쪽 아이콘에만 줌
    className: "sidebar-menu-link",
  };
  if (to) {
    return <NavLink {...common} component={RouterLink} to={to} active={location.pathname.startsWith(to)} />;
  }
  return <NavLink {...common} component="button" type="button" onClick={onClick} />;
}
