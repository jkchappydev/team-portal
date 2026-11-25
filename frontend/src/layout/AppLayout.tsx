import { useEffect, useLayoutEffect, useRef } from "react";
import { AppShell, Box, Overlay, Transition } from "@mantine/core";
import { useDisclosure, useMediaQuery } from "@mantine/hooks";
import { Outlet, useLocation } from "react-router-dom";
import { ImageLightbox } from "../documents/editor/ImageLightbox";
import { useCurrentUser } from "../user/currentUser";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
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
  // 좁은 화면은 사이드바를 서랍처럼 열고 닫고, 위쪽 줄에 메뉴 버튼을 둠
  const mobile = useMediaQuery("(max-width: 47.99em)") ?? false;
  // 다른 화면으로 옮기면 열린 사이드바를 닫아 본문이 보이게 함
  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);
  // 좁은 화면에서 사이드바가 열려 있는 동안은 덮인 본문이 스크롤되지 않게 페이지 스크롤을 잠금
  // (사이드바 메뉴 목록은 자체 스크롤 영역이라 그대로 스크롤됨)
  useEffect(() => {
    if (!mobile || !navOpened) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, [mobile, navOpened]);
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main || prefersReducedMotion() || typeof main.animate !== "function") return;
    main.animate([{ opacity: 0 }, { opacity: 1 }], { duration: PAGE_FADE_MS, easing: "ease-out" });
  }, [pathname]);
  return <AppShell
    header={{ height: { base: 48, sm: 56 } }}
    navbar={{ width: 260, breakpoint: "sm", collapsed: { mobile: !navOpened } }}
    padding="md">
    {/* 화면 맨 위 한 줄: 포털 이름·검색·알림·내 정보 (좁은 화면은 사이드바 여는 메뉴 버튼 포함) */}
    <AppShell.Header>
      <TopBar user={user} mobile={mobile} navOpened={navOpened} onToggleNav={toggleNav} />
    </AppShell.Header>
    <AppShell.Navbar><Sidebar user={user} /></AppShell.Navbar>
    {/* 좁은 화면: 사이드바(80%, index.css)가 열리면 남은 본문을 어둡게 덮고, 누르면 닫음 (사이드바 z-index 101 바로 아래) */}
    <Transition mounted={mobile && navOpened} transition="fade" duration={200}>
      {(styles) => (
        <Overlay fixed zIndex={100} color="#000" backgroundOpacity={0.35} onClick={closeNav} data-testid="nav-overlay"
          // 덮개 위에서 손가락으로 끌어도 뒤 본문이 움직이지 않게 (iOS Safari는 overflow 잠금만으로 부족)
          style={{ ...styles, top: "var(--app-shell-header-height, 0px)", touchAction: "none" }} />
      )}
    </Transition>
    {/* 메뉴 화면은 회색 바탕 위에 흰 칸, 페이지·파일·일정 편집 화면은 흰 바탕 */}
    <AppShell.Main className={ownPadding ? undefined : "app-main-muted"}>
      {/* 메뉴 화면은 위쪽도 왼쪽과 같은 여백, 아래쪽도 위쪽과 같은 여백 (모든 화면 공통, 사이드바 제외) */}
      {user && (
        <Box ref={mainRef} px={ownPadding ? 0 : { base: 0, sm: 24 }} pt={ownPadding ? 0 : { base: 0, sm: 24 }}
          pb={ownPadding ? 0 : { base: 0, sm: 24 }}>
          <Outlet />
        </Box>
      )}
      {/* 새로 접수된 CS 토스트 (모든 화면) */}
      {user && <NewCsToasts />}
      {/* 본문 이미지 펼쳐보기 창 (편집기 도구 막대의 펼치기 버튼이 엶) */}
      <ImageLightbox />
    </AppShell.Main>
  </AppShell>;
}
