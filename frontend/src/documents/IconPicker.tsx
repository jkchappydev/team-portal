import { useRef, useState } from "react";
import type { ClipboardEvent, ReactNode } from "react";
import { Alert, Box, Button, Group, Popover, Tabs, Text, UnstyledButton } from "@mantine/core";
import { EmojiPicker } from "frimousse";
import { ko } from "@blocknote/core/locales";
import { uploadAttachment } from "../api/attachments";
import { ApiError } from "../api/client";
import { randomIcon } from "./pageIcon";
import { resolveEmojiData } from "./emojiData";

interface Props {
  // 선택 창을 여는 버튼
  target: (toggle: () => void) => ReactNode;
  // 현재 아이콘이 있을 때만 제거 버튼 표시
  hasIcon: boolean;
  // null이면 아이콘 제거
  onSelect: (icon: string | null) => void;
  // 업로드 이미지를 붙일 페이지 (없으면 업로드 탭을 숨김)
  documentId?: number;
}

// 아이콘으로 올릴 수 있는 이미지 (SVG는 스크립트를 포함할 수 있어 제외, 서버도 같은 기준으로 검사)
const ICON_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_ICON_IMAGE_BYTES = 5 * 1024 * 1024;

type Pending = { kind: "file"; file: File; preview: string } | { kind: "url"; url: string };

// 노션처럼 이모지 탭(본문 이모지 선택 창과 같은 목록)과 이미지 업로드 탭으로 고르는 아이콘 선택 창
export function IconPicker({ target, hasIcon, onSelect, documentId }: Props) {
  const [opened, setOpened] = useState(false);
  const [tab, setTab] = useState<string | null>("emoji");

  const select = (icon: string | null) => {
    onSelect(icon);
    setOpened(false);
  };

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" width={360} shadow="md" withinPortal>
      <Popover.Target>{target(() => setOpened((v) => !v))}</Popover.Target>
      <Popover.Dropdown p={0}>
        <Tabs value={tab} onChange={setTab} keepMounted={false}>
          <Group justify="space-between" wrap="nowrap" px="xs" style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}>
            <Tabs.List style={{ borderBottom: 0 }}>
              <Tabs.Tab value="emoji">이모지</Tabs.Tab>
              {documentId != null && <Tabs.Tab value="upload">업로드</Tabs.Tab>}
            </Tabs.List>
            <Group gap={4} wrap="nowrap">
              {tab === "emoji" && (
                <Button size="compact-xs" variant="subtle" color="gray" onClick={() => select(randomIcon())}>랜덤</Button>
              )}
              {hasIcon && (
                <Button size="compact-xs" variant="subtle" color="gray" onClick={() => select(null)}>제거</Button>
              )}
            </Group>
          </Group>
          <Tabs.Panel value="emoji">
            <EmojiPicker.Root
              className="icon-emoji-picker"
              locale="ko"
              columns={9}
              resolveEmojiData={resolveEmojiData}
              onEmojiSelect={({ emoji }) => select(emoji)}
            >
              <EmojiPicker.Search placeholder={ko.emoji_picker.search} autoFocus />
              <EmojiPicker.Viewport>
                <EmojiPicker.Loading className="icon-emoji-status">{ko.emoji_picker.loading}</EmojiPicker.Loading>
                <EmojiPicker.Empty className="icon-emoji-status">{ko.emoji_picker.search_no_results}</EmojiPicker.Empty>
                <EmojiPicker.List />
              </EmojiPicker.Viewport>
              <div className="icon-emoji-footer">
                <EmojiPicker.ActiveEmoji>
                  {({ emoji }) => (
                    <div className="icon-emoji-active">
                      {emoji && <span className="icon-emoji-active-glyph">{emoji.emoji}</span>}
                      <span className="icon-emoji-active-label">{emoji ? emoji.label : `${ko.emoji_picker.search}…`}</span>
                    </div>
                  )}
                </EmojiPicker.ActiveEmoji>
                <EmojiPicker.SkinToneSelector className="icon-emoji-skin-tone" />
              </div>
            </EmojiPicker.Root>
          </Tabs.Panel>
          {documentId != null && (
            <Tabs.Panel value="upload">
              <IconUpload documentId={documentId} onDone={select} onCancel={() => setOpened(false)} />
            </Tabs.Panel>
          )}
        </Tabs>
      </Popover.Dropdown>
    </Popover>
  );
}

// 이미지 파일을 고르거나 Ctrl+V로 이미지·https 이미지 주소를 붙여넣고 저장
function IconUpload({ documentId, onDone, onCancel }: { documentId: number; onDone: (icon: string) => void; onCancel: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!ICON_IMAGE_TYPES.includes(file.type)) {
      setError("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_ICON_IMAGE_BYTES) {
      setError("5MB 이하 이미지만 올릴 수 있습니다.");
      return;
    }
    setError(null);
    setPending({ kind: "file", file, preview: URL.createObjectURL(file) });
  };

  const paste = (e: ClipboardEvent) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      pickFile(file);
      return;
    }
    const text = e.clipboardData.getData("text").trim();
    if (!text) return;
    e.preventDefault();
    if (!/^https:\/\/\S+$/.test(text) || text.length > 512) {
      setError("https로 시작하는 이미지 주소만 붙여넣을 수 있습니다.");
      return;
    }
    setError(null);
    setPending({ kind: "url", url: text });
  };

  const save = async () => {
    if (!pending) return;
    if (pending.kind === "url") {
      onDone(pending.url);
      return;
    }
    setSaving(true);
    try {
      const uploaded = await uploadAttachment(documentId, pending.file, true);
      onDone(`att:${uploaded.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "이미지를 올리지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // 탭 안 어디서든 Ctrl+V로 붙여넣을 수 있도록 포커스를 받는 영역
    <Box p="sm" tabIndex={0} onPaste={paste} data-autofocus style={{ outline: "none" }} aria-label="아이콘 이미지 업로드">
      <input ref={fileInput} type="file" accept={ICON_IMAGE_TYPES.join(",")} hidden aria-label="아이콘 이미지 파일"
        onChange={(e) => {
          pickFile(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }} />
      <UnstyledButton
        onClick={() => fileInput.current?.click()}
        w="100%"
        p="md"
        style={{ borderRadius: 8, background: "var(--mantine-color-gray-0)", textAlign: "center" }}
      >
        {pending ? (
          <Group justify="center" gap="sm">
            <img src={pending.kind === "file" ? pending.preview : pending.url} alt="" referrerPolicy="no-referrer"
              style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 6 }} />
            <Text size="sm" c="dimmed">다른 이미지 선택</Text>
          </Group>
        ) : (
          <Text size="sm">🖼️ 이미지 업로드</Text>
        )}
      </UnstyledButton>
      <Text size="xs" c="dimmed" ta="center" mt="xs">또는 Ctrl+V 단축키로 이미지나 링크를 붙여넣으세요.</Text>
      {error && <Alert color="red" mt="xs" p="xs">{error}</Alert>}
      <Group justify="space-between" mt="sm">
        <Button size="xs" variant="subtle" color="gray" onClick={onCancel}>취소</Button>
        <Button size="xs" disabled={!pending} loading={saving} onClick={() => void save()}>저장</Button>
      </Group>
    </Box>
  );
}
