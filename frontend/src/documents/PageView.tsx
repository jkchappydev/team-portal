import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ActionIcon, Alert, Box, Button, Group, Loader, Menu, Text, TextInput, UnstyledButton } from "@mantine/core";
import type { DocumentDetailDto } from "../api/documents";
import type { MemberDto } from "../api/members";
import { IconPicker } from "./IconPicker";
import { PageIcon } from "./PageIconView";
import { formatDateTime } from "./format";
import { shouldFocusTitle } from "./titleFocus";

// 편집기 번들은 페이지 화면에서만 로드
const CollaborativeEditor = lazy(() => import("./CollaborativeEditor"));

interface Props {
  doc: DocumentDetailDto;
  user: MemberDto;
  // 제목 위 경로 표시 (하위 페이지에서만)
  breadcrumb?: ReactNode;
  // ⋯ 메뉴 항목
  menuItems: ReactNode;
  onRename: (title: string) => void;
  renameError?: string | null;
  // 본문 아래 영역 (프로젝트의 하위 페이지 목록)
  footer?: ReactNode;
  // 아이콘 변경 (없으면 아이콘 영역을 표시하지 않음, null이면 제거)
  onChangeIcon?: (icon: string | null) => void;
}

// 노션처럼 큰 제목 + 바로 쓰는 편집기로 구성한 페이지 화면
export function PageView({ doc, user, breadcrumb, menuItems, onRename, renameError, footer, onChangeIcon }: Props) {
  // 편집 중인 제목 (null이면 서버 제목 표시)
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
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
    <Box maw={1100} mx="auto" px={{ base: "md", sm: 56 }}>
      {/* 노션처럼 위 경로 줄과 페이지 아이콘·제목 사이에 여백을 둠 */}
      <Group justify="space-between" mb={28} wrap="nowrap" mih={28}>
        <Box style={{ minWidth: 0 }}>{breadcrumb}</Box>
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <ActionIcon variant="subtle" color="gray" aria-label="페이지 메뉴">⋯</ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>{menuItems}</Menu.Dropdown>
        </Menu>
      </Group>
      <Box className="page-title">
        {/* 노션처럼 아이콘이 있으면 제목 위에 크게, 없으면 마우스를 올렸을 때 추가 버튼 */}
        {onChangeIcon && (
          <IconPicker
            hasIcon={!!doc.icon}
            documentId={doc.id}
            onSelect={onChangeIcon}
            target={(toggle) => doc.icon ? (
              <UnstyledButton
                onClick={toggle}
                aria-label="아이콘 변경"
                className="page-row"
                style={{ fontSize: 56, lineHeight: 1.2, borderRadius: 8, padding: "0 4px" }}
              >
                <PageIcon icon={doc.icon} />
              </UnstyledButton>
            ) : (
              <Button
                variant="subtle"
                color="gray"
                size="compact-xs"
                onClick={toggle}
                className="icon-add"
              >
                😀 아이콘 추가
              </Button>
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
      <Text size="xs" c="dimmed" mb="md">
        마지막 수정 {doc.updatedByName ?? "-"} · {formatDateTime(doc.updatedAt)}
      </Text>
      {renameError && <Alert color="red" mb="sm">{renameError}</Alert>}
      {/* 첨부 파일은 본문에 끌어다 놓아 넣으므로 별도 첨부 패널 없이 본문만 표시 */}
      <Box className="page-editor">
        <Suspense fallback={<Loader size="sm" />}>
          <CollaborativeEditor key={`${doc.id}-${user.id}`} documentId={doc.id} user={user} />
        </Suspense>
      </Box>
      {footer}
    </Box>
  );
}
