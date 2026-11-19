import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActionIcon, Alert, Box, Button, Group, Loader, Menu, Text, TextInput, UnstyledButton } from "@mantine/core";
import type { DocumentDetailDto } from "../api/documents";
import type { MemberDto } from "../api/members";
import { FavoriteButton } from "./FavoriteButton";
import { CoverPicker } from "./CoverPicker";
import { IconPicker } from "./IconPicker";
import { iconImageSrc } from "./pageIcon";
import { PageIcon } from "./PageIconView";
import { PresenceAvatars } from "./PresenceAvatars";
import type { Viewer } from "./presence";
import { formatDateTime } from "./format";
import { PageProperties } from "./properties/PageProperties";
import { shouldFocusTitle } from "./titleFocus";

// 편집기 번들은 페이지 화면에서만 로드
const CollaborativeEditor = lazy(() => import("./CollaborativeEditor"));

interface Props {
  doc: DocumentDetailDto;
  user: MemberDto;
  // 제목 위 경로 표시 (하위 페이지에서만)
  breadcrumb?: ReactNode;
  // ⋯ 메뉴 항목 (없으면 ⋯ 버튼 미표시)
  menuItems?: ReactNode;
  onRename: (title: string) => void;
  renameError?: string | null;
  // 아이콘 변경 (없으면 아이콘 영역을 표시하지 않음, null이면 제거)
  onChangeIcon?: (icon: string | null) => void;
  // 커버 변경 (프로젝트 화면에서만, 없으면 커버 영역을 표시하지 않음, null이면 제거)
  onChangeCover?: (cover: string | null) => void;
}

// "아이콘 추가"에 쓰는 회색 선 웃는 얼굴
function SmileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round">
      <circle cx="8" cy="8" r="6.4" />
      <circle cx="5.9" cy="6.6" r="0.55" fill="currentColor" stroke="none" />
      <circle cx="10.1" cy="6.6" r="0.55" fill="currentColor" stroke="none" />
      <path d="M5.4 9.6c.6.9 1.5 1.4 2.6 1.4s2-.5 2.6-1.4" />
    </svg>
  );
}

// "커버 추가"에 쓰는 회색 선 그림 아이콘
function ImageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="10" rx="1.5" />
      <circle cx="5.8" cy="6.4" r="1" />
      <path d="M2.5 11.5l3.5-3 2.5 2 2-1.6 3 2.6" />
    </svg>
  );
}

// 노션처럼 큰 제목 + 바로 쓰는 편집기로 구성한 페이지 화면
export function PageView({ doc, user, breadcrumb, menuItems, onRename, renameError, onChangeIcon, onChangeCover }: Props) {
  // 편집 중인 제목 (null이면 서버 제목 표시)
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  // 지금 이 페이지를 보고 있는 사람, 나 포함 (편집기 접속 상태에서 받아옴)
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const focusTitle = shouldFocusTitle(location.state, doc.id);

  // 방금 만든 페이지면 제목 칸에 포커스를 주고 "제목 없음"을 선택해 바로 덮어쓰게 함.
  // 새로고침·뒤로 가기 때 다시 포커스되지 않도록 화면 상태는 비움
  useEffect(() => {
    if (!focusTitle) return;
    titleRef.current?.focus();
    titleRef.current?.select();
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [focusTitle, navigate, location.pathname, location.search]);

  // 비어 있거나 바뀌지 않은 제목은 저장하지 않음
  const saveTitle = () => {
    if (titleDraft === null) return;
    const next = titleDraft.trim();
    if (next && next !== doc.title) {
      onRename(next);
    }
    setTitleDraft(null);
  };

  return (
    // 넓은 화면에서는 본문 왼쪽 바깥에 줄 드래그 핸들이 들어갈 여백 확보
    <Box maw={1100} mx="auto" px={{ base: 40, sm: 56 }}>
      {/* 좁은 화면은 좌우 여백을 40px로 넓혀 블록 손잡이(+ ⠿)가 본문을 덮지 않고 여백 안에 들어가게 함 (좌우 같은 폭) */}
      {/* 노션처럼 위 경로 줄과 페이지 아이콘·제목 사이에 여백을 둠 */}
      <Group className="print-hide" justify="space-between" mb={28} wrap="nowrap" mih={28}>
        <Box style={{ minWidth: 0 }}>{breadcrumb}</Box>
        <Group gap="xs" wrap="nowrap">
          <PresenceAvatars viewers={viewers} selfMemberId={user.id} />
          {/* 즐겨찾기 별: 노란 별이면 사이드바 즐겨찾기 목록에 들어 있음 */}
          <FavoriteButton documentId={doc.id} />
          {menuItems && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <ActionIcon variant="subtle" color="gray" aria-label="페이지 메뉴">⋯</ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>{menuItems}</Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>
      {/* 프로젝트 커버: 있으면 제목 위에 가로 띠, 마우스를 올리면 변경·제거 */}
      {onChangeCover && doc.cover && (
        <Box className="page-cover">
          <img src={iconImageSrc(doc.cover) ?? undefined} alt="" draggable={false} referrerPolicy="no-referrer" />
          <Group className="page-cover-actions" gap={4} wrap="nowrap">
            <CoverPicker
              hasCover
              documentId={doc.id}
              onSelect={onChangeCover}
              target={(toggle) => (
                <Button size="compact-xs" variant="default" onClick={toggle}>커버 변경</Button>
              )}
            />
            <Button size="compact-xs" variant="default" onClick={() => onChangeCover(null)}>커버 제거</Button>
          </Group>
        </Box>
      )}
      <Box className="page-title">
        {/* 노션처럼 "아이콘 추가"·"커버 추가"는 제목 영역에 마우스를 올렸을 때만 보이는 회색 버튼 */}
        {((onChangeIcon && !doc.icon) || (onChangeCover && !doc.cover)) && (
          <Group gap={4} wrap="nowrap">
            {onChangeIcon && !doc.icon && (
              <IconPicker
                hasIcon={false}
                documentId={doc.id}
                onSelect={onChangeIcon}
                target={(toggle) => (
                  // 노션처럼 회색 선 아이콘 + 보통 굵기 회색 글자, 마우스를 올리면 옅은 배경
                  <UnstyledButton onClick={toggle} className="icon-add">
                    <SmileIcon />
                    아이콘 추가
                  </UnstyledButton>
                )}
              />
            )}
            {onChangeCover && !doc.cover && (
              <CoverPicker
                hasCover={false}
                documentId={doc.id}
                onSelect={onChangeCover}
                target={(toggle) => (
                  <UnstyledButton onClick={toggle} className="icon-add">
                    <ImageIcon />
                    커버 추가
                  </UnstyledButton>
                )}
              />
            )}
          </Group>
        )}
        {/* 노션처럼 아이콘이 있으면 제목 위에 크게 */}
        {onChangeIcon && doc.icon && (
          <IconPicker
            hasIcon
            documentId={doc.id}
            onSelect={onChangeIcon}
            target={(toggle) => (
              <UnstyledButton
                onClick={toggle}
                aria-label="아이콘 변경"
                className="page-row"
                // 노션처럼 큰 아이콘과 제목 사이를 띄움
                style={{ fontSize: 56, lineHeight: 1.2, borderRadius: 8, padding: "0 4px", marginBottom: 20 }}
              >
                <PageIcon icon={doc.icon} />
              </UnstyledButton>
            )}
          />
        )}
        <TextInput
          ref={titleRef}
          variant="unstyled"
          maxLength={doc.home ? 100 : 200}
          value={titleDraft ?? doc.title}
          placeholder="제목 없음"
          onChange={(e) => setTitleDraft(e.currentTarget.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          aria-label={doc.home ? "페이지 이름" : "페이지 제목"}
          styles={{ input: { fontSize: 36, fontWeight: 700, height: "auto", lineHeight: 1.25, paddingBlock: 4 } }}
        />
      </Box>
      <Text className="print-hide" size="xs" c="dimmed" mb="md">
        마지막 수정 {doc.updatedByName ?? "-"} · {formatDateTime(doc.updatedAt)}
      </Text>
      {renameError && <Alert color="red" mb="sm">{renameError}</Alert>}
      {/* 노션처럼 제목 아래 속성 (기본 담당자, 사용자가 추가) */}
      <PageProperties documentId={doc.id} />
      {/* 첨부 파일은 본문에 끌어다 놓아 넣으므로 별도 첨부 패널 없이 본문만 표시 */}
      {/* 페이지 본문에서는 "/일정"으로 이 페이지 아래에 일정 블록을 넣을 수 있음 */}
      <Box className="page-editor">
        <Suspense fallback={<Loader size="sm" />}>
          <CollaborativeEditor key={`${doc.id}-${user.id}`} documentId={doc.id} user={user}
            spaceId={doc.kind === "PAGE" ? doc.spaceId : undefined} onViewersChange={setViewers} />
        </Suspense>
      </Box>
    </Box>
  );
}
