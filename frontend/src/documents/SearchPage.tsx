import { useState } from "react";
import { Alert, Button, Group, Loader, Table, Text, TextInput, Title } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { searchDocuments } from "../api/documents";
import { formatDateTime } from "./format";

export function SearchPage() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const { data: results = [], error, isFetching } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchDocuments(query),
    enabled: query.length > 0,
  });

  return (
    <>
      <Title order={3} mb="md">검색</Title>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(input.trim());
        }}
      >
        <Group mb="md" align="flex-end">
          <TextInput
            style={{ flex: 1, maxWidth: 480 }}
            placeholder="제목 또는 본문 검색"
            value={input}
            onChange={(e) => setInput(e.currentTarget.value)}
            aria-label="검색어"
            data-autofocus
          />
          <Button type="submit">검색</Button>
        </Group>
      </form>
      {error && <Alert color="red" mb="sm">검색하지 못했습니다.</Alert>}
      {isFetching && <Loader size="sm" />}
      {query && !isFetching && !error && results.length === 0 && <Text c="dimmed">검색 결과가 없습니다.</Text>}
      {results.length > 0 && (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={200}>공간</Table.Th>
              <Table.Th>제목</Table.Th>
              <Table.Th w={180}>수정 시각</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {results.map((doc) => (
              <Table.Tr key={doc.id}>
                <Table.Td>{doc.spaceName ?? "-"}</Table.Td>
                <Table.Td>
                  <Link to={`/documents/${doc.id}`}>{doc.title}</Link>
                </Table.Td>
                <Table.Td>{formatDateTime(doc.updatedAt)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
