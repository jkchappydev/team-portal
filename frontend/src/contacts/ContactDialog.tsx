import { useState } from "react";
import { Alert, Avatar, Button, CheckIcon, ColorSwatch, Group, Modal, SimpleGrid, Stack, Text, TextInput, Textarea } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { CONTACTS_KEY, createContact, updateContact } from "../api/contacts";
import type { ContactDto } from "../api/contacts";
import { formatPhone } from "../members/phone";
import { CONTACT_COLORS, contactColor } from "./contactColor";

// 연락처 추가·수정 창 (editing이 있으면 수정)
export function ContactDialog({ opened, editing, onClose }: { opened: boolean; editing: ContactDto | null; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title={editing ? "연락처 수정" : "연락처 추가"} centered>
      {/* 열릴 때마다 입력값을 새로 잡도록 key로 다시 만듦 */}
      {/* 닫힌 뒤에는 Modal이 내용을 지워 다시 열면 새 입력으로 시작 (닫히는 동안에는 입력 내용 유지) */}
      <ContactForm key={editing?.id ?? "new"} editing={editing} onClose={onClose} />
    </Modal>
  );
}

function ContactForm({ editing, onClose }: { editing: ContactDto | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(editing?.name ?? "");
  const [company, setCompany] = useState(editing?.company ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [phone, setPhone] = useState(editing?.phone ?? "");
  const [phone2, setPhone2] = useState(editing?.phone2 ?? "");
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [project, setProject] = useState(editing?.project ?? "");
  // null이면 자동 색 (카드에서 연락처 번호로 정함)
  const [color, setColor] = useState<string | null>(editing?.color ?? null);

  const save = useMutation({
    mutationFn: () => {
      // 비어 있는 항목은 null로 보냄
      const body = {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        phone2: phone2.trim() || null,
        project: project.trim() || null,
        memo: memo.trim() || null,
        color,
      };
      return editing ? updateContact(editing.id, body) : createContact(body);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_KEY });
      onClose();
    },
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate(); }}>
      <Stack>
        <TextInput label="이름" required data-autofocus value={name} maxLength={50}
          onChange={(e) => setName(e.currentTarget.value)} />
        {/* 카드 이름 동그라미 색: 고른 색을 다시 누르면 자동으로 돌아감 */}
        <div>
          {/* 자동 버튼은 내 설정 색처럼 제목 오른쪽 */}
          <Group gap="xs" mb={6}>
            <Text size="sm" fw={500}>색</Text>
            <Button size="compact-xs" variant="light" color="gray" aria-pressed={color === null}
              onClick={() => setColor(null)}>자동</Button>
          </Group>
          <Group gap="md" wrap="nowrap" align="center">
            <Avatar radius="xl" size={40} variant="filled" aria-label="색 미리보기"
              color={color ?? (editing ? contactColor({ id: editing.id, color: null }) : "gray")}>{name.trim().slice(0, 1) || "?"}</Avatar>
            <SimpleGrid cols={6} spacing={6} verticalSpacing={6}>
              {CONTACT_COLORS.map((swatch) => (
                <ColorSwatch key={swatch} component="button" type="button" color={swatch} size={24}
                  aria-label={`색 ${swatch}`} aria-pressed={color === swatch}
                  style={{ color: "white", cursor: "pointer" }}
                  onClick={() => setColor(color === swatch ? null : swatch)}>
                  {color === swatch && <CheckIcon size={10} />}
                </ColorSwatch>
              ))}
            </SimpleGrid>
          </Group>
        </div>
        <TextInput label="업체" placeholder="예: 가나출판" value={company} maxLength={100}
          onChange={(e) => setCompany(e.currentTarget.value)} />
        <TextInput label="이메일" type="email" placeholder="name@example.com" value={email} maxLength={255}
          onChange={(e) => setEmail(e.currentTarget.value)} />
        {/* 팀원 전화번호와 같이 입력하는 대로 하이픈을 맞춤 */}
        <TextInput label="전화번호 1" placeholder="010-1234-5678" value={phone} maxLength={20}
          onChange={(e) => setPhone(formatPhone(e.currentTarget.value))} />
        <TextInput label="전화번호 2" placeholder="02-123-4567" value={phone2} maxLength={20}
          onChange={(e) => setPhone2(formatPhone(e.currentTarget.value))} />
        {/* 정해진 이름이 없어 자유롭게 (여러 개면 쉼표로 이어서) */}
        <TextInput label="연관 프로젝트" placeholder="예: 교과서 개발, 전자책 제작" value={project} maxLength={500}
          onChange={(e) => setProject(e.currentTarget.value)} />
        {/* 메모는 창 맨 아래 (통화 가능 시간 등 자유롭게) */}
        <Textarea label="메모" value={memo} maxLength={1000} autosize minRows={2} maxRows={6}
          onChange={(e) => setMemo(e.currentTarget.value)} />
        {save.error && (
          <Alert color="red">{save.error instanceof ApiError ? save.error.message : "저장하지 못했습니다."}</Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>취소</Button>
          <Button type="submit" loading={save.isPending} disabled={!name.trim()}>{editing ? "저장" : "추가"}</Button>
        </Group>
      </Stack>
    </form>
  );
}
