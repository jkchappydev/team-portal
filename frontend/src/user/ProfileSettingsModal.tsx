import { useEffect, useRef, useState } from "react";
import type { DragEvent } from "react";
import { ActionIcon, Anchor, Avatar, Box, Button, CheckIcon, ColorSwatch, Group, Modal, Stack, Tabs, Text, Tooltip, useMantineColorScheme } from "@mantine/core";
import type { MantineColorScheme } from "@mantine/core";
import { ColorSchemeToggle } from "../layout/ColorSchemeToggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { JOB_RANKS, listMembers, updateMember } from "../api/members";
import type { MemberDto } from "../api/members";
import { MemberInfoFields } from "../members/MemberInfoForm";
import { isMemberInfoComplete, memberInfoRequest, toMemberInfoValues } from "../members/memberInfo";
import type { MemberInfoValues } from "../members/memberInfo";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import { NOTIFICATION_SETTINGS_KEY } from "./notificationSettingsKey";
import { changeNotificationSetting } from "../api/notificationSettings";
import type { NotificationLevel } from "../api/notificationSettings";
import { DOCUMENT_UPDATES_KEY } from "../notifications/useMarkDocumentRead";
import { changeProfileColor, removeProfileImage, uploadProfileImage } from "../api/profile";
import type { ProfileDto } from "../api/profile";
import { shortName } from "../documents/presence";
import { PROFILE_COLORS, userColor } from "../documents/userColor";
import { CameraLineIcon, UploadLineIcon } from "../documents/DefaultIcons";

interface Props {
  user: MemberDto;
  opened: boolean;
  onClose: () => void;
}

// 서버와 같은 기준: 2MB 이하 PNG·JPG·GIF·WEBP
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = "image/png,image/jpeg,image/gif,image/webp";

// 지금 색과 다른 색 하나를 무작위로 고름
export function randomColor(current: string, random: () => number = Math.random): string {
  const candidates = PROFILE_COLORS.filter((swatch) => swatch !== current);
  return candidates[Math.floor(random() * candidates.length)];
}

type SettingsTab = "info" | "profile" | "notifications";

// 탭 내용 높이: 내 정보 칸이 스크롤 없이 다 보이는 높이 (화면이 낮으면 줄이고 스크롤바 없이 스크롤)
const PANEL_HEIGHT = "min(450px, 62vh)";

// 저장 전에 고른 프로필 이미지: 새 파일(미리보기 주소 포함) 또는 지우기
type ImageDraft = { kind: "upload"; file: File; previewUrl: string } | { kind: "remove" };

// 설정 창: 위쪽에 내 프로필(누르면 이미지 바꾸기), 아래 가로 탭으로 내 정보·개인 설정·알림을 나눔
// Modal은 닫으면 내용을 내리므로, 저장하지 않고 닫은 변경은 다시 열 때 사라짐
export function ProfileSettingsModal({ user, opened, onClose }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="설정" centered size="lg">
      <SettingsContent user={user} />
    </Modal>
  );
}

// 세 탭에서 바꾼 내용은 모아 두었다가 창 아래 저장 버튼 하나로 함께 저장
function SettingsContent({ user }: { user: MemberDto }) {
  const queryClient = useQueryClient();
  // 내 부서·직책·연락처는 팀원 목록에서 가져옴
  const { data: members } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true) });
  const myInfo = members?.find((member) => member.id === user.id);
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const [tab, setTab] = useState<SettingsTab>("info");

  // 저장 전 변경 (undefined·빈 값이면 바꾸지 않음)
  const [infoDraft, setInfoDraft] = useState<MemberInfoValues>();
  const [colorDraft, setColorDraft] = useState<string>();
  const [imageDraft, setImageDraft] = useState<ImageDraft>();
  const [themeDraft, setThemeDraft] = useState<MantineColorScheme>();
  const [notificationDraft, setNotificationDraft] = useState<Record<number, NotificationLevel>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 고른 이미지 미리보기 주소는 바꾸거나 창을 닫으면 해제
  const previewUrl = imageDraft?.kind === "upload" ? imageDraft.previewUrl : undefined;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const originalInfo = myInfo ? toMemberInfoValues(myInfo) : undefined;
  const infoValues = infoDraft ?? originalInfo;
  const infoChanged = !!infoDraft && !!originalInfo && JSON.stringify(infoDraft) !== JSON.stringify(originalInfo);
  const themeChanged = !!themeDraft && themeDraft !== colorScheme;
  const dirty = infoChanged || colorDraft !== undefined || !!imageDraft || themeChanged
    || Object.keys(notificationDraft).length > 0;
  const canSave = dirty && (!infoChanged || isMemberInfoComplete(infoDraft!));

  // 저장 전 변경을 반영한 미리보기용 내 정보
  const preview: MemberDto = {
    ...user,
    profileColor: colorDraft ?? user.profileColor,
    profileImageUrl: imageDraft ? (imageDraft.kind === "upload" ? imageDraft.previewUrl : null) : user.profileImageUrl,
  };
  const rank = JOB_RANKS.find((item) => item.value === myInfo?.jobRank)?.label;
  const subtitle = [myInfo?.department, rank].filter(Boolean).join(" · ");

  // 무언가 바꾸면 이전 저장 결과 문구를 지움
  const edited = () => { setSaved(false); setError(null); };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    setSaved(false);
    if (!IMAGE_TYPES.split(",").includes(file.type)) {
      setError("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("프로필 이미지는 2MB까지 올릴 수 있습니다.");
      return;
    }
    setError(null);
    setImageDraft({ kind: "upload", file, previewUrl: URL.createObjectURL(file) });
  };

  // 바꾼 것만 차례로 저장 (이미지 → 색 순서로 마지막 프로필 결과를 로그인 정보에 반영)
  const save = useMutation({
    mutationFn: async () => {
      if (infoChanged) await updateMember(user.id, memberInfoRequest(infoDraft!));
      let profile: ProfileDto | undefined;
      if (imageDraft?.kind === "upload") profile = await uploadProfileImage(imageDraft.file);
      else if (imageDraft?.kind === "remove") profile = await removeProfileImage();
      if (colorDraft !== undefined) profile = await changeProfileColor(colorDraft);
      for (const [spaceId, level] of Object.entries(notificationDraft)) {
        await changeNotificationSetting(Number(spaceId), level);
      }
      return profile;
    },
    onMutate: () => { setSaved(false); setError(null); },
    onSuccess: (profile) => {
      if (profile) queryClient.setQueryData(["auth", "me"], (me: object | undefined) => me && { ...me, ...profile });
      // 화면 테마는 이 브라우저에만 저장되며 저장할 때 적용
      if (themeChanged) setColorScheme(themeDraft!);
      setInfoDraft(undefined);
      setColorDraft(undefined);
      setImageDraft(undefined);
      setThemeDraft(undefined);
      setNotificationDraft({});
      setSaved(true);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "저장하지 못했습니다."),
    // 일부만 저장되고 실패해도 화면이 서버 값을 다시 읽음 (사이드바 직책, 종 알림 목록 포함)
    onSettled: () => {
      if (infoChanged) {
        void queryClient.invalidateQueries({ queryKey: ["members"] });
        void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      }
      if (Object.keys(notificationDraft).length > 0) {
        void queryClient.invalidateQueries({ queryKey: NOTIFICATION_SETTINGS_KEY });
        void queryClient.invalidateQueries({ queryKey: DOCUMENT_UPDATES_KEY });
      }
    },
  });

  const fileRef = useRef<HTMLInputElement>(null);
  const appearance: Appearance = {
    user: preview,
    theme: themeDraft ?? colorScheme,
    disabled: save.isPending,
    pickFile,
    openFilePicker: () => fileRef.current?.click(),
    changeColor: (color) => { edited(); setColorDraft(color); },
    removeImage: () => { edited(); setImageDraft(user.profileImageUrl ? { kind: "remove" } : undefined); },
    changeTheme: (theme) => { edited(); setThemeDraft(theme); },
  };

  return (
    <>
      {/* 프로필 띠: 큰 동그라미 오른쪽 아래 카메라 버튼으로 이미지를 고름 (저장 전에는 미리보기) */}
      <Group gap="md" wrap="nowrap" pb="md">
        <Box pos="relative" style={{ flexShrink: 0 }}>
          <ProfileAvatar user={preview} size={60} fontSize={20} />
          <Tooltip label="프로필 이미지 바꾸기" withArrow>
            <ActionIcon variant="default" radius="xl" size={24} aria-label="프로필 이미지 바꾸기"
              disabled={save.isPending} onClick={appearance.openFilePicker}
              style={{ position: "absolute", right: -2, bottom: -2 }}>
              <CameraLineIcon size={13} />
            </ActionIcon>
          </Tooltip>
        </Box>
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text fw={600} size="lg" truncate>{user.name}</Text>
          {subtitle && <Text size="xs" c="dimmed">{subtitle}</Text>}
          {user.email && <Text size="xs" c="dimmed" truncate>{user.email}</Text>}
        </Stack>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_TYPES}
          hidden
          data-testid="profile-image-input"
          onChange={(e) => {
            pickFile(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </Group>

      {/* 탭을 바꿔도 저장 전 입력이 남도록 내용은 그려 둔 채 숨김만 바꿈 */}
      <Tabs value={tab} onChange={(value) => value && setTab(value as SettingsTab)} keepMounted>
        <Tabs.List>
          <Tabs.Tab value="info">내 정보</Tabs.Tab>
          <Tabs.Tab value="profile">개인 설정</Tabs.Tab>
          <Tabs.Tab value="notifications">알림</Tabs.Tab>
        </Tabs.List>

        {/* 탭마다 내용 길이가 달라도 창 크기는 그대로 두고, 넘치는 내용은 탭 안에서 스크롤 */}
        <Tabs.Panel value="info" pt="md" h={PANEL_HEIGHT} className="settings-panel-scroll">
          {/* 가입 때 입력한 부서·직책·연락처 (최초 가입 정보 입력 화면과 같은 칸) */}
          {myInfo && infoValues ? (
            <MemberInfoFields name={myInfo.name} originalDepartment={myInfo.department} values={infoValues}
              onChange={(values) => { edited(); setInfoDraft(values); }} />
          ) : (
            <Text size="xs" c="dimmed">내 정보를 불러오는 중...</Text>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="profile" pt="md" h={PANEL_HEIGHT} className="settings-panel-scroll">
          <ProfileAppearanceForm appearance={appearance} />
        </Tabs.Panel>

        <Tabs.Panel value="notifications" pt="md" h={PANEL_HEIGHT} className="settings-panel-scroll">
          {tab === "notifications" && (
            <NotificationSettingsForm draft={notificationDraft}
              onChange={(spaceId, level) => { edited(); setNotificationDraft((draft) => ({ ...draft, [spaceId]: level })); }} />
          )}
        </Tabs.Panel>
      </Tabs>

      {/* 세 탭 공통 저장 버튼과 저장 결과 (탭 내용 아래 구분선 밑, 어느 탭에서든 같은 자리) */}
      <Group justify="flex-end" gap="sm" wrap="nowrap" pt="sm"
        style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
        {error && <Text size="xs" c="red" ta="right">{error}</Text>}
        {saved && !error && <Text size="xs" c="blue">저장했습니다.</Text>}
        <Button loading={save.isPending} disabled={!canSave} onClick={() => save.mutate()}>
          저장
        </Button>
      </Group>
    </>
  );
}

// 이미지가 없으면 이름 두 글자를 내 색 동그라미에
function ProfileAvatar({ user, size, fontSize }: { user: MemberDto; size: number; fontSize: number }) {
  return (
    <Avatar
      size={size}
      radius="xl"
      src={user.profileImageUrl}
      aria-label="내 프로필 미리 보기"
      styles={{ placeholder: {
        background: user.profileColor ?? userColor(user.id), color: "white", fontSize, fontWeight: 400,
        letterSpacing: "-0.02em", WebkitFontSmoothing: "antialiased",
      } }}
    >
      {shortName(user.name)}
    </Avatar>
  );
}

// 개인 설정 탭이 쓰는 저장 전 값과 바꾸는 함수
interface Appearance {
  user: MemberDto;
  theme: MantineColorScheme;
  disabled: boolean;
  pickFile: (file: File | undefined) => void;
  openFilePicker: () => void;
  changeColor: (color: string) => void;
  removeImage: () => void;
  changeTheme: (theme: MantineColorScheme) => void;
}

// 페이지를 볼 때 다른 사람에게 보이는 내 동그라미의 이미지와 색, 화면 테마 (저장 버튼을 눌러야 반영)
function ProfileAppearanceForm({ appearance }: { appearance: Appearance }) {
  const { user, disabled, pickFile } = appearance;
  // 이미지 파일을 끌고 놓는 칸 위에 올라와 있는 동안 놓을 자리 표시
  const [dragging, setDragging] = useState(false);
  const color = user.profileColor ?? userColor(user.id);
  const hasImage = !!user.profileImageUrl;

  // 탐색기에서 끌어 온 이미지 파일을 놓으면 고른 것과 같이 처리
  const dragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  };
  const dragLeave = (e: DragEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };
  const drop = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    pickFile(files.find((f) => f.type.startsWith("image/")) ?? files[0]);
  };

  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Text size="sm" fw={500}>프로필 이미지</Text>
        {/* 점선 칸에 끌어다 놓거나 파일 고르기 (끄는 동안 칸 강조) */}
        <Group gap="sm" wrap="nowrap" px="md" py="sm" aria-label="프로필 이미지 놓는 곳"
          onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop}
          style={{
            borderRadius: 8,
            border: `1px dashed ${dragging ? "var(--mantine-primary-color-filled)" : "var(--mantine-color-default-border)"}`,
            background: dragging ? "var(--mantine-primary-color-light)" : undefined,
          }}>
          <Box c="dimmed" style={{ display: "flex" }}><UploadLineIcon size={20} /></Box>
          <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm">
              {dragging ? "여기에 놓으면 이미지를 바꿉니다." : (
                <>이미지를 끌어다 놓거나{" "}
                  <Anchor component="button" type="button" size="sm" fw={600} disabled={disabled}
                    onClick={appearance.openFilePicker}>
                    파일 고르기
                  </Anchor>
                </>
              )}
            </Text>
            <Text size="xs" c="dimmed">2MB 이하 PNG, JPG, GIF, WEBP. 이미지가 없으면 이름과 색으로 보입니다.</Text>
          </Stack>
          {hasImage && (
            <Button size="xs" variant="subtle" color="gray" disabled={disabled} onClick={appearance.removeImage}>
              이미지 지우기
            </Button>
          )}
        </Group>
      </Stack>

      <Stack gap={6}>
        {/* 자동 버튼(무작위로 한 색 고름)은 색 제목 바로 옆 */}
        <Group gap="xs">
          <Text size="sm" fw={500}>색</Text>
          <Tooltip label="아래 색 중 하나를 자동으로 고름" withArrow>
            <Button size="compact-xs" variant="default" fw={500} disabled={disabled}
              onClick={() => appearance.changeColor(randomColor(color))}>
              자동
            </Button>
          </Tooltip>
        </Group>
        <Group gap={10}>
          {PROFILE_COLORS.map((swatch) => (
            <ColorSwatch
              key={swatch}
              component="button"
              type="button"
              color={swatch}
              size={26}
              aria-label={`색 ${swatch}`}
              aria-pressed={user.profileColor === swatch}
              disabled={disabled}
              style={{ color: "white", cursor: "pointer" }}
              onClick={() => { if (user.profileColor !== swatch) appearance.changeColor(swatch); }}
            >
              {user.profileColor === swatch && <CheckIcon size={12} />}
            </ColorSwatch>
          ))}
        </Group>
      </Stack>

      <Stack gap={6} align="flex-start">
        <Text size="sm" fw={500}>화면 테마</Text>
        <ColorSchemeToggle value={appearance.theme} onChange={appearance.changeTheme} />
        <ThemePreview theme={appearance.theme} />
      </Stack>
    </Stack>
  );
}

// 테마별 모형 화면 색 (앱의 라이트·다크 배경과 같은 Mantine 색)
const THEME_SWATCHES = {
  light: { body: "var(--mantine-color-white)", side: "var(--mantine-color-gray-0)", line: "var(--mantine-color-gray-3)", border: "var(--mantine-color-gray-3)" },
  dark: { body: "var(--mantine-color-dark-7)", side: "var(--mantine-color-dark-8)", line: "var(--mantine-color-dark-4)", border: "var(--mantine-color-dark-4)" },
};

// 고른 화면 테마로 그린 작은 포털 화면 모형 (시스템은 같은 모형을 왼쪽 라이트·오른쪽 다크로 나눠 보여 줌)
function ThemePreview({ theme }: { theme: MantineColorScheme }) {
  return (
    <Box pos="relative" w={150} h={64} aria-label="화면 테마 미리보기" data-theme={theme}
      style={{ borderRadius: 6, overflow: "hidden", border: "1px solid var(--mantine-color-default-border)" }}>
      <ThemeMock colors={THEME_SWATCHES[theme === "dark" ? "dark" : "light"]} />
      {theme === "auto" && <ThemeMock colors={THEME_SWATCHES.dark} clipPath="inset(0 0 0 50%)" />}
    </Box>
  );
}

// 사이드바·제목·본문 줄·버튼만 있는 모형 (clipPath: 시스템 미리보기에서 위에 겹쳐 일부만 보일 때)
function ThemeMock({ colors, clipPath }: { colors: typeof THEME_SWATCHES.light; clipPath?: string }) {
  const bar = (width: number | string, height = 3, background = colors.line) => (
    <Box style={{ width, height, borderRadius: 2, background }} />
  );
  return (
    <Box pos="absolute" inset={0} style={{ display: "flex", background: colors.body, clipPath }}>
      {/* 사이드바 */}
      <Stack gap={4} p={5} style={{ width: 38, flexShrink: 0, background: colors.side, borderRight: `1px solid ${colors.border}` }}>
        {bar("60%", 4)}
        {bar("80%")}
        {bar("70%")}
        {bar("75%")}
      </Stack>
      {/* 본문 */}
      <Stack gap={4} p={6} style={{ flex: 1 }}>
        {bar("45%", 5)}
        {bar("90%")}
        {bar("80%")}
        {bar("65%")}
        <Box mt={1}>{bar(22, 7, "var(--mantine-primary-color-filled)")}</Box>
      </Stack>
    </Box>
  );
}
