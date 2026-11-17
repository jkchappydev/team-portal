import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Alert, Avatar, Button, CheckIcon, ColorSwatch, Box, Group, Modal, NavLink, SimpleGrid, Stack, Text, Tooltip, useMantineColorScheme } from "@mantine/core";
import { ColorSchemeToggle } from "../layout/ColorSchemeToggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { listMembers } from "../api/members";
import type { MemberDto } from "../api/members";
import { MemberInfoForm } from "../members/MemberInfoForm";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
import { changeProfileColor, removeProfileImage, uploadProfileImage } from "../api/profile";
import type { ProfileDto } from "../api/profile";
import { shortName } from "../documents/presence";
import { PROFILE_COLORS, userColor } from "../documents/userColor";

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
// 알림은 내 설정 아래 탭
const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: "info", label: "개인정보 수정" }, { value: "profile", label: "내 설정" }, { value: "notifications", label: "알림" },
];

// 설정 창: 왼쪽 탭으로 개인정보 수정, 내 설정(프로필 모양), 알림(프로젝트별 알림 받기)을 나눔
export function ProfileSettingsModal({ user, opened, onClose }: Props) {
  const queryClient = useQueryClient();
  // 내 부서·직책·연락처는 팀원 목록에서 가져옴
  const { data: members } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true), enabled: opened });
  const myInfo = members?.find((member) => member.id === user.id);
  const [infoSaved, setInfoSaved] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("info");

  return (
    <Modal opened={opened} onClose={onClose} title="설정" centered size="lg">
      {/* 왼쪽 메뉴는 사이드바 고정 메뉴(NavLink)와 같은 모양에서 아이콘만 뺌 */}
      {/* 탭마다 내용 길이가 달라도 창 크기는 그대로 두고, 넘치는 내용은 오른쪽 칸 안에서 스크롤 */}
      <Group align="stretch" gap={0} wrap="nowrap" h="min(440px, 70vh)">
        <Stack gap={0} w={140} pr="xs" role="tablist" aria-orientation="vertical"
          style={{ flexShrink: 0, borderRight: "1px solid var(--mantine-color-default-border)" }}>
          {SETTINGS_TABS.map((item) => (
            <NavLink
              key={item.value}
              component="button"
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              label={item.label}
              py={4}
              pl={6}
              active={tab === item.value}
              onClick={() => setTab(item.value)}
            />
          ))}
        </Stack>

        {/* 탭을 바꿔도 저장 전 입력이 남도록 두 내용을 모두 그려 두고 숨김만 바꿈 */}
        <Box role="tabpanel" aria-label="개인정보 수정" hidden={tab !== "info"} pl="lg" pr="xs" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {/* 가입 때 입력한 부서·직책·연락처 (최초 가입 정보 입력 화면과 같은 양식) */}
          <Stack gap="xs">
            {myInfo ? (
              <MemberInfoForm
                key={`${myInfo.department}-${myInfo.jobRank}-${myInfo.phone}-${myInfo.extension}`}
                member={myInfo}
                submitLabel="저장"
                onSaved={() => {
                  setInfoSaved(true);
                  void queryClient.invalidateQueries({ queryKey: ["members"] });
                  // 사이드바 이름 옆 직책도 바로 바뀌도록 로그인 정보 다시 조회
                  void queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
                }}
              />
            ) : (
              <Text size="xs" c="dimmed">내 정보를 불러오는 중...</Text>
            )}
            {infoSaved && <Text size="xs" c="teal" ta="right">저장했습니다.</Text>}
          </Stack>
        </Box>

        <Box role="tabpanel" aria-label="내 설정" hidden={tab !== "profile"} pl="lg" pr="xs" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          <ProfileAppearanceForm user={user} />
        </Box>

        <Box role="tabpanel" aria-label="알림" hidden={tab !== "notifications"} pl="lg" pr="xs" style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {tab === "notifications" && <NotificationSettingsForm />}
        </Box>
      </Group>
    </Modal>
  );
}

// 페이지를 볼 때 다른 사람에게 보이는 내 동그라미의 색과 이미지, 화면 테마
// 저장 버튼 없이 고르는 즉시 저장 (개인정보 수정 탭만 저장 버튼 사용)
function ProfileAppearanceForm({ user }: { user: MemberDto }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // 이미지 파일을 끌고 프로필 이미지 칸 위에 올라와 있는 동안 놓을 자리 표시
  const [dragging, setDragging] = useState(false);
  // 화면 테마는 이 브라우저에만 저장되며 고르면 바로 적용
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  const color = user.profileColor ?? userColor(user.id);
  const hasImage = !!user.profileImageUrl;

  // 바꾼 결과를 로그인 정보에 반영해 화면 전체가 새 색·이미지를 씀
  const save = useMutation({
    mutationFn: (change: () => Promise<ProfileDto>) => change(),
    onMutate: () => { setSaved(false); setError(null); },
    onSuccess: (profile) => {
      queryClient.setQueryData(["auth", "me"], (me: object | undefined) => me && { ...me, ...profile });
      setSaved(true);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "저장하지 못했습니다."),
  });

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.split(",").includes(file.type)) {
      setSaved(false);
      setError("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setSaved(false);
      setError("프로필 이미지는 2MB까지 올릴 수 있습니다.");
      return;
    }
    save.mutate(() => uploadProfileImage(file));
  };

  // 탐색기에서 끌어 온 이미지 파일을 놓으면 고른 것과 같이 바로 올림
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
    onPickFile(files.find((f) => f.type.startsWith("image/")) ?? files[0]);
  };

  return (
    <Stack gap="lg">
      <Group gap="md" wrap="nowrap">
        <Avatar
          size={64}
          radius="xl"
          src={user.profileImageUrl}
          aria-label="내 프로필 미리 보기"
          styles={{ placeholder: {
            background: color, color: "white", fontSize: 20, fontWeight: 400,
            letterSpacing: "-0.02em", WebkitFontSmoothing: "antialiased",
          } }}
        >
          {shortName(user.name)}
        </Avatar>
        <Stack gap={4}>
          <Text fw={600}>{user.name}</Text>
          {user.email && <Text size="xs" c="dimmed">{user.email}</Text>}
        </Stack>
      </Group>

      {/* 이미지 파일을 이 칸에 끌어다 놓아도 올라감 (끄는 동안 점선 테두리) */}
      <Stack gap="xs" aria-label="프로필 이미지 놓는 곳" onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop}
        p={6} m={-6} style={{
          borderRadius: 8,
          background: dragging ? "var(--mantine-primary-color-light)" : undefined,
          outline: dragging ? "2px dashed var(--mantine-primary-color-filled)" : "2px dashed transparent",
          outlineOffset: -2,
        }}>
        <Text size="sm" fw={500}>프로필 이미지</Text>
        <Group gap="xs">
          <Button size="xs" variant="light" loading={save.isPending} onClick={() => fileRef.current?.click()}>
            {hasImage ? "이미지 바꾸기" : "이미지 올리기"}
          </Button>
          {hasImage && (
            <Button size="xs" variant="subtle" color="gray" disabled={save.isPending}
              onClick={() => save.mutate(removeProfileImage)}>
              이미지 지우기
            </Button>
          )}
        </Group>
        <Text size="xs" c="dimmed">{dragging ? "여기에 놓으면 바로 올라갑니다." : "2MB 이하 PNG, JPG, GIF, WEBP. 끌어다 놓아도 됩니다. 이미지가 없으면 이름과 색으로 보입니다."}</Text>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_TYPES}
          hidden
          data-testid="profile-image-input"
          onChange={(e) => {
            onPickFile(e.currentTarget.files?.[0]);
            e.currentTarget.value = "";
          }}
        />
      </Stack>

      <Stack gap="xs">
        {/* 자동 버튼(무작위로 한 색 고름)은 제목 오른쪽 */}
        <Group gap="xs">
          <Text size="sm" fw={500}>색</Text>
          <Tooltip label="아래 색 중 하나를 자동으로 골라 바꿈" withArrow>
            <Button size="compact-xs" variant="light" color="gray" disabled={save.isPending}
              onClick={() => { const next = randomColor(color); save.mutate(() => changeProfileColor(next)); }}>
              자동
            </Button>
          </Tooltip>
        </Group>
        <SimpleGrid cols={6} spacing={8} verticalSpacing={8} w="fit-content">
          {PROFILE_COLORS.map((swatch) => (
            <ColorSwatch
              key={swatch}
              component="button"
              type="button"
              color={swatch}
              size={28}
              aria-label={`색 ${swatch}`}
              aria-pressed={user.profileColor === swatch}
              disabled={save.isPending}
              style={{ color: "white", cursor: "pointer" }}
              onClick={() => { if (user.profileColor !== swatch) save.mutate(() => changeProfileColor(swatch)); }}
            >
              {user.profileColor === swatch && <CheckIcon size={12} />}
            </ColorSwatch>
          ))}
        </SimpleGrid>
      </Stack>

      <Stack gap="xs">
        <Text size="sm" fw={500}>화면 테마</Text>
        <ColorSchemeToggle value={colorScheme} onChange={(value) => { setColorScheme(value); setError(null); setSaved(true); }} />
      </Stack>

      {error && <Alert color="red" p="xs">{error}</Alert>}
      {saved && !error && <Text size="xs" c="teal" ta="right">저장했습니다.</Text>}
    </Stack>
  );
}
