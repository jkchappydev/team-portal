import { useEffect, useRef, useState } from "react";
import { Alert, Box, Group, Highlight, Kbd, Loader, Modal, Text, UnstyledButton } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { searchDocuments } from "../api/documents";
import { listSpaces } from "../api/spaces";
import { isProjectHome } from "../notifications/updateFormat";
import type { DocumentSummaryDto } from "../api/documents";
import { formatDateTime } from "./format";
import { itemPath } from "./itemPath";
import { PageIcon } from "./PageIconView";

// 서버 검색은 두 글자 이상부터 동작
const MIN_QUERY_LENGTH = 2;

// 고르기 모드: 문서를 여는 대신 고른 페이지를 돌려줌 (블록 "옮기기"의 대상 페이지 고르기)
export interface SearchPick {
  placeholder: string;
  // Enter 안내 문구 (예: 옮기기)
  actionLabel: string;
  // 고를 수 없는 페이지 (지금 페이지 등)
  exclude: (doc: DocumentSummaryDto) => boolean;
  onPick: (doc: DocumentSummaryDto) => void;
}

interface Props {
  opened: boolean;
  onClose: () => void;
  pick?: SearchPick;
}

// 노션처럼 얇은 선으로 그린 돋보기 아이콘
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}

export function SearchDialog({ opened, onClose, pick }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size={620}
      yOffset="12vh"
      padding={0}
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.35 }}
      // 닫은 뒤 사이드바 검색 메뉴로 포커스가 돌아가 파란 테두리가 남지 않게 함
      returnFocus={false}
    >
      {/* 열 때마다 검색어와 선택을 초기화 */}
      {opened && <SearchBody onClose={onClose} pick={pick} />}
    </Modal>
  );
}

function SearchBody({ onClose, pick }: { onClose: () => void; pick?: SearchPick }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const [debounced] = useDebouncedValue(input.trim(), 200);
  const query = input.trim().length >= MIN_QUERY_LENGTH ? debounced : "";

  const { data: found = [], error, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchDocuments(query),
    enabled: query.length >= MIN_QUERY_LENGTH,
  });
  // 고르기 모드는 블록을 담을 수 있는 페이지만
  const results = pick ? found.filter((doc) => doc.kind === "PAGE" && !pick.exclude(doc)) : found;

  // 프로젝트 본문 결과는 아이콘이 없으면 사이드바처럼 폴더 아이콘
  const { data: spaces = [] } = useQuery({ queryKey: ["spaces"], queryFn: listSpaces });

  // 방향키로 고른 항목이 목록 밖에 있으면 보이도록 스크롤
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)?.scrollIntoView?.({ block: "nearest" });
  }, [selected]);

  // 페이지는 편집 화면, 파일 항목은 미리보기 화면으로 이동
  const open = (doc: DocumentSummaryDto) => {
    onClose();
    if (pick) pick.onPick(doc);
    else navigate(itemPath(doc.kind, doc.id));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      open(results[Math.min(selected, results.length - 1)]);
    }
  };

  const tooShort = input.trim().length > 0 && input.trim().length < MIN_QUERY_LENGTH;
  // 입력 전에는 검색 칸만 보여 줌
  const hasBody = input.trim().length > 0 || !!error;

  return (
    <>
      <Group
        gap="sm"
        px="lg"
        h={58}
        wrap="nowrap"
        style={hasBody ? { borderBottom: "1px solid var(--mantine-color-default-border)" } : undefined}
      >
        <Box c="dimmed" style={{ display: "flex", flexShrink: 0 }}><SearchIcon /></Box>
        <input
          className="search-dialog-input"
          aria-label={pick ? pick.placeholder : "문서 검색"}
          placeholder={pick ? pick.placeholder : "문서 제목이나 내용으로 검색"}
          value={input}
          onChange={(e) => {
            setInput(e.currentTarget.value);
            setSelected(0);
          }}
          onKeyDown={onKeyDown}
          data-autofocus
        />
        {isFetching ? <Loader size="xs" /> : <Kbd size="xs" style={{ flexShrink: 0 }}>Esc</Kbd>}
      </Group>
      {hasBody && (
        <Box ref={listRef} mah="50vh" style={{ overflowY: "auto" }} p={8}>
          {error && <Alert color="red" m="xs">검색하지 못했습니다.</Alert>}
          {tooShort && <Text c="dimmed" fz="sm" px="sm" py="md" ta="center">두 글자 이상 입력하세요.</Text>}
          {query && !isFetching && !error && results.length === 0 && (
            <Text c="dimmed" fz="sm" px="sm" py="md" ta="center">검색 결과가 없습니다.</Text>
          )}
          {results.length > 0 && (
            <Text fz={11} fw={600} c="dimmed" px="sm" pt={4} pb={6}>페이지 {results.length}</Text>
          )}
          {results.map((doc, i) => (
            <UnstyledButton
              key={doc.id}
              data-index={i}
              onClick={() => open(doc)}
              onMouseEnter={() => setSelected(i)}
              w="100%"
              px="sm"
              py={8}
              style={{
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: i === selected ? "var(--mantine-color-default-hover)" : undefined,
              }}
            >
              <Box
                fz={18}
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  border: "1px solid var(--mantine-color-default-border)",
                }}
              >
                <PageIcon icon={doc.icon} project={isProjectHome(doc, spaces)} />
              </Box>
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Highlight highlight={query} fz="sm" fw={500} truncate
                  highlightStyles={{ background: "transparent", color: "var(--mantine-primary-color-filled)", padding: 0 }}>
                  {doc.title}
                </Highlight>
                <Text fz="xs" c="dimmed" truncate>
                  {doc.spaceName ?? "-"} · {formatDateTime(doc.updatedAt)}
                </Text>
              </Box>
              {i === selected && <Kbd size="xs" style={{ flexShrink: 0 }}>Enter</Kbd>}
            </UnstyledButton>
          ))}
        </Box>
      )}
      {results.length > 0 && (
        <Group
          gap="md"
          px="lg"
          py={8}
          style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
        >
          <Text fz="xs" c="dimmed"><Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> 이동</Text>
          <Text fz="xs" c="dimmed"><Kbd size="xs">Enter</Kbd> {pick ? pick.actionLabel : "열기"}</Text>
          <Text fz="xs" c="dimmed"><Kbd size="xs">Esc</Kbd> 닫기</Text>
        </Group>
      )}
    </>
  );
}
