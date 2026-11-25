import { useState } from "react";
import { ActionIcon, Box, Group, Kbd, Menu, Text, UnstyledButton } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { Link as RouterLink } from "react-router-dom";
import { logout } from "../api/auth";
import type { MemberDto } from "../api/members";
import { SearchDialog } from "../documents/SearchDialog";
import { RankBadge } from "../members/RankBadge";
import { DocumentUpdatesBell } from "../notifications/DocumentUpdatesBell";
import { ProfileSettingsModal } from "../user/ProfileSettingsModal";

interface Props {
  user: MemberDto | null;
  mobile: boolean;
  navOpened: boolean;
  onToggleNav: () => void;
}

const SEARCH_ICON = (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}
    strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

// 화면 맨 위 한 줄: 포털 이름, 검색, 수정 알림, 내 정보(설정·로그아웃)
export function TopBar({ user, mobile, navOpened, onToggleNav }: Props) {
  const [searching, setSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // 노션처럼 어디서든 Ctrl/Cmd+K로 검색 창 열기
  useHotkeys([["mod+K", () => setSearching(true)]], []);

  return (
    <Group h="100%" px={{ base: "md", sm: "sm" }} gap="sm" wrap="nowrap">
      {/* 좁은 화면 전용 사이드바 열기/닫기 (닫힘 ☰, 열림 «) */}
      {mobile && (
        <ActionIcon variant="subtle" color="gray" size="lg" onClick={onToggleNav} aria-label={navOpened ? "메뉴 닫기" : "메뉴 열기"}>
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.6}
            strokeLinecap="round" strokeLinejoin="round">
            <path d={navOpened ? "M10 5 5 10l5 5 M15 5l-5 5 5 5" : "M3.5 5.5h13 M3.5 10h13 M3.5 14.5h13"} />
          </svg>
        </ActionIcon>
      )}
      {/* 포털 이름을 누르면 메인으로 (넓은 화면은 사이드바 폭에 맞춰 검색창이 본문 위에서 시작) */}
      <Box w={mobile ? undefined : 236} style={{ flex: mobile ? 1 : "none", minWidth: 0 }}>
        <Text fw={700} size={mobile ? "md" : "lg"} truncate component={RouterLink} to="/"
          style={{ color: "inherit", textDecoration: "none" }}>
          개발팀
        </Text>
      </Box>
      {mobile ? (
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="검색" onClick={() => setSearching(true)}>
          {SEARCH_ICON}
        </ActionIcon>
      ) : (
        <Group justify="center" style={{ flex: 1, minWidth: 0 }}>
          <UnstyledButton className="top-search" aria-label="검색" onClick={() => setSearching(true)}>
            {SEARCH_ICON}
            <Text size="sm" c="dimmed" style={{ flex: 1 }}>검색</Text>
            <Kbd size="xs">Ctrl + K</Kbd>
          </UnstyledButton>
        </Group>
      )}
      {user && <DocumentUpdatesBell />}
      {user && (
        <Menu position="bottom-end" width={160}>
          <Menu.Target>
            <UnstyledButton className="top-user" aria-label="내 정보">
              <Text size="sm" truncate>{user.name}</Text>
              {!mobile && user.jobRank && <RankBadge rank={user.jobRank} style={{ cursor: "pointer" }} />}
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth={2}
                strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.6 }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </UnstyledButton>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => setSettingsOpen(true)}>설정</Menu.Item>
            <Menu.Item onClick={() => void logout()}>로그아웃</Menu.Item>
          </Menu.Dropdown>
        </Menu>
      )}
      <SearchDialog opened={searching} onClose={() => setSearching(false)} />
      {user && <ProfileSettingsModal user={user} opened={settingsOpen} onClose={() => setSettingsOpen(false)} />}
    </Group>
  );
}
