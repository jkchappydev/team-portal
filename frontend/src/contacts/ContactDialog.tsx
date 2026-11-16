import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, TagsInput, TextInput, Textarea } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { CONTACTS_KEY, createContact, updateContact } from "../api/contacts";
import type { ContactDto } from "../api/contacts";
import { formatPhone } from "../members/phone";

// 연락처 추가·수정 창 (editing이 있으면 수정)
export function ContactDialog({ opened, editing, onClose }: { opened: boolean; editing: ContactDto | null; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title={editing ? "연락처 수정" : "연락처 추가"} centered>
      {/* 열릴 때마다 입력값을 새로 잡도록 key로 다시 만듦 */}
      {opened && <ContactForm key={editing?.id ?? "new"} editing={editing} onClose={onClose} />}
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
  const [projects, setProjects] = useState<string[]>(editing?.projects ?? []);
  // 연관 프로젝트 칸에 입력만 하고 Enter를 누르지 않은 값
  const [projectDraft, setProjectDraft] = useState("");

  const save = useMutation({
    mutationFn: () => {
      // 비어 있는 항목은 null로 보냄
      const body = {
        name: name.trim(),
        company: company.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        phone2: phone2.trim() || null,
        // Enter 없이 저장해도 입력 중인 프로젝트를 함께 넣음
        projects: projectDraft.trim() && !projects.includes(projectDraft.trim()) ? [...projects, projectDraft.trim()] : projects,
        memo: memo.trim() || null,
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
        <TextInput label="업체" placeholder="예: 가나출판" value={company} maxLength={100}
          onChange={(e) => setCompany(e.currentTarget.value)} />
        <TextInput label="이메일" type="email" placeholder="name@example.com" value={email} maxLength={255}
          onChange={(e) => setEmail(e.currentTarget.value)} />
        {/* 팀원 전화번호와 같이 입력하는 대로 하이픈을 맞춤 */}
        <TextInput label="전화번호 1" placeholder="010-1234-5678" value={phone} maxLength={20}
          onChange={(e) => setPhone(formatPhone(e.currentTarget.value))} />
        <TextInput label="전화번호 2" placeholder="02-123-4567" value={phone2} maxLength={20}
          onChange={(e) => setPhone2(formatPhone(e.currentTarget.value))} />
        <TagsInput label="연관 프로젝트" description="입력 후 Enter로 여러 개를 넣을 수 있습니다." value={projects}
          onChange={setProjects} searchValue={projectDraft} onSearchChange={setProjectDraft}
          maxTags={20} clearable splitChars={[","]} />
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
