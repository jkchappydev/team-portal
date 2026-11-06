import { useState } from "react";
import { Alert, Box, Loader, Modal, Text, TextInput, UnstyledButton } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { searchDocuments } from "../api/documents";
import type { DocumentSummaryDto } from "../api/documents";
import { formatDateTime } from "./format";
import { PageIcon } from "./PageIconView";

// 서버 검색은 두 글자 이상부터 동작
const MIN_QUERY_LENGTH = 2;

interface Props {
  opened: boolean;
  onClose: () => void;
}

export function SearchDialog({ opened, onClose }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      size="lg"
      yOffset="12vh"
      padding={0}
      radius="md"
    >
      {/* 열 때마다 검색어와 선택을 초기화 */}
      {opened && <SearchBody onClose={onClose} />}
    </Modal>
  );
}

function SearchBody({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState(0);
  const [debounced] = useDebouncedValue(input.trim(), 200);
  const query = input.trim().length >= MIN_QUERY_LENGTH ? debounced : "";

  const { data: results = [], error, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchDocuments(query),
    enabled: query.length >= MIN_QUERY_LENGTH,
  });

  // 페이지는 편집 화면, 파일 항목은 미리보기 화면으로 이동
  const open = (doc: DocumentSummaryDto) => {
    onClose();
    navigate(doc.kind === "FILE" ? `/files/${doc.id}` : `/documents/${doc.id}`);
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

  return (
    <>
      <TextInput
        aria-label="문서 검색"
        placeholder="문서 제목이나 내용으로 검색"
        value={input}
        onChange={(e) => {
          setInput(e.currentTarget.value);
          setSelected(0);
        }}
        onKeyDown={onKeyDown}
        variant="unstyled"
        size="lg"
        px="md"
        rightSection={isFetching ? <Loader size="xs" /> : null}
        data-autofocus
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
      />
      <Box mah="50vh" style={{ overflowY: "auto" }} p={6}>
        {error && <Alert color="red" m="xs">검색하지 못했습니다.</Alert>}
        {tooShort && <Text c="dimmed" fz="sm" p="sm">두 글자 이상 입력하세요.</Text>}
        {!input.trim() && <Text c="dimmed" fz="sm" p="sm">찾을 문서의 제목이나 내용을 입력하세요.</Text>}
        {query && !isFetching && !error && results.length === 0 && (
          <Text c="dimmed" fz="sm" p="sm">검색 결과가 없습니다.</Text>
        )}
        {results.map((doc, i) => (
          <UnstyledButton
            key={doc.id}
            onClick={() => open(doc)}
            onMouseEnter={() => setSelected(i)}
            w="100%"
            px="sm"
            py={8}
            style={{
              borderRadius: 6,
              display: "block",
              background: i === selected ? "var(--mantine-color-default-hover)" : undefined,
            }}
          >
            <Text fz="sm" fw={500} truncate><PageIcon icon={doc.icon} />{" "}<span>{doc.title}</span></Text>
            <Text fz="xs" c="dimmed" truncate>
              {doc.spaceName ?? "-"} · {formatDateTime(doc.updatedAt)}
            </Text>
          </UnstyledButton>
        ))}
      </Box>
    </>
  );
}
