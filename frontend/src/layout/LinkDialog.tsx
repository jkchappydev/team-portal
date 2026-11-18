import { useRef, useState } from "react";
import { Alert, Button, Group, Modal, Stack, Text, Textarea, TextInput, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPicker } from "../documents/IconPicker";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createLink, LINKS_KEY, updateLink } from "../api/links";
import type { LinkDto } from "../api/links";
import { ApiError } from "../api/client";
import { markNewItem } from "./reorderAnimation";

interface Props {
  opened: boolean;
  onClose: () => void;
  // 수정할 링크 (없으면 새 링크 추가)
  editing?: LinkDto | null;
}

// 노션처럼 얇은 선으로 그린 링크 아이콘
export function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 9.5a2.8 2.8 0 0 0 4 0l2.2-2.2a2.8 2.8 0 0 0-4-4L7.6 4.4" />
      <path d="M9.5 6.5a2.8 2.8 0 0 0-4 0L3.3 8.7a2.8 2.8 0 0 0 4 4l1.1-1.1" />
    </svg>
  );
}

// 아이콘을 고르지 않았을 때 제목 칸 앞에 보이는 웃는 얼굴 (누르면 이모지 선택)
function SmileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden fill="none" stroke="currentColor"
      strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <path d="M5.6 9.4a2.8 2.8 0 0 0 4.8 0" />
      <path d="M6 6.4h.01M10 6.4h.01" strokeWidth="1.8" />
    </svg>
  );
}

// 필수 칸 이름표 (별표를 이름 앞에 표시)
function RequiredLabel({ children }: { children: string }) {
  return (
    <>
      <Text component="span" c="red" inherit aria-hidden>*</Text> {children}
    </>
  );
}

// 제목과 주소를 넣어 사이드바 링크 추가·수정 (같은 팝업)
export function LinkDialog({ opened, onClose, editing = null }: Props) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      withCloseButton={false}
      centered
      size={440}
      padding={0}
      radius="lg"
      overlayProps={{ backgroundOpacity: 0.35 }}
      returnFocus={false}
    >
      {/* 열 때마다 입력을 초기화 */}
      {/* 닫힌 뒤에는 Modal이 내용을 지워 다시 열면 새 입력으로 시작 (닫히는 동안에는 입력 내용 유지) */}
      <LinkBody key={editing?.id ?? "new"} onClose={onClose} editing={editing} />
    </Modal>
  );
}

function LinkBody({ onClose, editing }: { onClose: () => void; editing: LinkDto | null }) {
  const queryClient = useQueryClient();
  // 수정이면 기존 값으로 채워서 시작
  const [title, setTitle] = useState(editing?.title ?? "");
  const [url, setUrl] = useState(editing?.url ?? "");
  const [icon, setIcon] = useState<string | null>(editing?.icon ?? null);
  const [accountInfo, setAccountInfo] = useState(editing?.accountInfo ?? "");
  const urlRef = useRef<HTMLInputElement>(null);
  const add = useMutation({
    mutationFn: () => {
      // 계정 정보는 선택값, 비어 있으면 없음으로 저장
      const account = accountInfo.trim() || null;
      return editing
        ? updateLink(editing.id, url.trim(), title.trim(), icon, account)
        : createLink(url.trim(), title.trim(), icon, account);
    },
    onSuccess: (link) => {
      if (!editing) markNewItem(`link-${link.id}`);
      void queryClient.invalidateQueries({ queryKey: LINKS_KEY });
      onClose();
    },
  });
  const invalid = add.error instanceof ApiError && add.error.code === "INVALID_INPUT";
  // 제목과 주소 모두 필수
  const ready = !!title.trim() && !!url.trim();
  const submit = () => {
    if (!ready || add.isPending) return;
    add.mutate();
  };
  return (
    <>
      <Text fw={600} fz="md" px="lg" pt="lg" pb="md">{editing ? "링크 수정" : "링크 추가"}</Text>
      <Stack gap="md" px="lg" pb="lg">
        <TextInput
          label={<RequiredLabel>제목</RequiredLabel>}
          aria-label="링크 제목"
          placeholder="예: 팀 위키"
          // 제목 앞 칸을 눌러 아이콘 선택 (선택값, 고르지 않으면 🔗)
          leftSection={
            <IconPicker
              hasIcon={!!icon}
              onSelect={setIcon}
              target={(toggle) => (
                <Tooltip label="아이콘 (선택)" withinPortal>
                  <UnstyledButton aria-label="링크 아이콘 선택" onClick={toggle} className="link-icon-button">
                    {icon ? <span aria-hidden>{icon}</span> : <SmileIcon />}
                  </UnstyledButton>
                </Tooltip>
              )}
            />
          }
          leftSectionPointerEvents="all"
          leftSectionWidth={40}
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.currentTarget.value)}
          onKeyDown={(e) => {
            // 제목 입력 후 Enter는 주소 칸으로 이동
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            urlRef.current?.focus();
          }}
          data-autofocus
        />
        <TextInput
          ref={urlRef}
          label={<RequiredLabel>주소</RequiredLabel>}
          aria-label="링크 주소"
          placeholder="https://"
          leftSection={<LinkIcon />}
          value={url}
          error={add.error ? (invalid ? "웹 주소(http, https)만 쓸 수 있습니다." : undefined) : undefined}
          onChange={(e) => {
            setUrl(e.currentTarget.value);
            add.reset();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            submit();
          }}
        />
        {/* 선택값, 넣어 두면 사이드바에서 링크를 눌렀을 때 팝업으로 보여줌 */}
        <Textarea
          label="계정 정보"
          aria-label="계정 정보"
          placeholder="아이디, 비밀번호 등"
          rows={3}
          maxLength={2000}
          value={accountInfo}
          onChange={(e) => setAccountInfo(e.currentTarget.value)}
        />
        {add.error && !invalid && <Alert color="red">{editing ? "링크를 수정하지 못했습니다." : "링크를 추가하지 못했습니다."}</Alert>}
      </Stack>
      <Group
        justify="flex-end"
        gap="xs"
        px="lg"
        py="sm"
        bg="var(--mantine-color-default-hover)"
        style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
      >
        <Button variant="default" onClick={onClose}>취소</Button>
        <Button onClick={submit} loading={add.isPending} disabled={!ready}>{editing ? "저장" : "추가"}</Button>
      </Group>
    </>
  );
}
