import { useRef, useState } from "react";
import type { DragEvent, RefObject } from "react";
import { ActionIcon, Anchor, Avatar, Box, Button, CheckIcon, ColorSwatch, Group, Modal, Stack, Tabs, Text, Tooltip, useMantineColorScheme } from "@mantine/core";
import { ColorSchemeToggle } from "../layout/ColorSchemeToggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { JOB_RANKS, listMembers } from "../api/members";
import type { MemberDto } from "../api/members";
import { MemberInfoForm } from "../members/MemberInfoForm";
import { NotificationSettingsForm } from "./NotificationSettingsForm";
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

// 설정 창: 위쪽에 내 프로필(누르면 이미지 바꾸기), 아래 가로 탭으로 내 정보·프로필 모양·알림을 나눔
export function ProfileSettingsModal({ user, opened, onClose }: Props) {
  const queryClient = useQueryClient();
  // 내 부서·직책·연락처는 팀원 목록에서 가져옴
  const { data: members } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true), enabled: opened });
  const myInfo = members?.find((member) => member.id === user.id);
  const [infoSaved, setInfoSaved] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("info");
  const appearance = useProfileAppearance();
  const rank = JOB_RANKS.find((item) => item.value === myInfo?.jobRank)?.label;
  const subtitle = [rank, myInfo?.department].filter(Boolean).join(" · ");

  return (
    <Modal opened={opened} onClose={onClose} title="설정" centered size="lg">
      {/* 프로필 띠: 큰 동그라미 오른쪽 아래 카메라 버튼으로 이미지를 바로 바꿈 */}
      <Group gap="md" wrap="nowrap" pb="md">
        <Box pos="relative" style={{ flexShrink: 0 }}>
          <ProfileAvatar user={user} size={60} fontSize={20} />
          <Tooltip label="프로필 이미지 바꾸기" withArrow>
            <ActionIcon variant="default" radius="xl" size={24} aria-label="프로필 이미지 바꾸기"
              loading={appearance.save.isPending} onClick={() => appearance.fileRef.current?.click()}
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
        {/* 이미지·색 저장 실패만 프로필 옆에 알림 (저장했습니다는 내 정보 저장 버튼을 눌렀을 때만) */}
        <Box ml="auto" maw={220} ta="right" style={{ flexShrink: 0 }}>
          {appearance.error && <Text size="xs" c="red">{appearance.error}</Text>}
        </Box>
        <ProfileImageInput appearance={appearance} />
      </Group>

      {/* 탭을 바꿔도 저장 전 입력이 남도록 내용은 그려 둔 채 숨김만 바꿈 */}
      <Tabs value={tab} onChange={(value) => value && setTab(value as SettingsTab)} keepMounted>
        <Tabs.List>
          <Tabs.Tab value="info">내 정보</Tabs.Tab>
          <Tabs.Tab value="profile">프로필 모양</Tabs.Tab>
          <Tabs.Tab value="notifications">알림</Tabs.Tab>
        </Tabs.List>

        {/* 탭마다 내용 길이가 달라도 창 크기는 그대로 두고, 넘치는 내용은 탭 안에서 스크롤 */}
        <Tabs.Panel value="info" pt="md" h="min(400px, 55vh)" style={{ overflowY: "auto" }}>
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
        </Tabs.Panel>

        <Tabs.Panel value="profile" pt="md" h="min(400px, 55vh)" style={{ overflowY: "auto" }}>
          <ProfileAppearanceForm user={user} appearance={appearance} />
        </Tabs.Panel>

        <Tabs.Panel value="notifications" pt="md" h="min(400px, 55vh)" style={{ overflowY: "auto" }}>
          {tab === "notifications" && <NotificationSettingsForm />}
        </Tabs.Panel>
      </Tabs>
    </Modal>
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

type Appearance = ReturnType<typeof useProfileAppearance>;

// 프로필 이미지·색 저장 (고르는 즉시 저장, 프로필 띠의 카메라 버튼과 프로필 모양 탭이 같이 씀)
function useProfileAppearance() {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 바꾼 결과를 로그인 정보에 반영해 화면 전체가 새 색·이미지를 씀
  const save = useMutation({
    mutationFn: (change: () => Promise<ProfileDto>) => change(),
    onMutate: () => setError(null),
    onSuccess: (profile) => {
      queryClient.setQueryData(["auth", "me"], (me: object | undefined) => me && { ...me, ...profile });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "저장하지 못했습니다."),
  });

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    if (!IMAGE_TYPES.split(",").includes(file.type)) {
      setError("PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("프로필 이미지는 2MB까지 올릴 수 있습니다.");
      return;
    }
    save.mutate(() => uploadProfileImage(file));
  };

  return { fileRef: fileRef as RefObject<HTMLInputElement>, save, error, pickFile };
}

function ProfileImageInput({ appearance }: { appearance: Appearance }) {
  return (
    <input
      ref={appearance.fileRef}
      type="file"
      accept={IMAGE_TYPES}
      hidden
      data-testid="profile-image-input"
      onChange={(e) => {
        appearance.pickFile(e.currentTarget.files?.[0]);
        e.currentTarget.value = "";
      }}
    />
  );
}

// 페이지를 볼 때 다른 사람에게 보이는 내 동그라미의 이미지와 색, 화면 테마
// 저장 버튼 없이 고르는 즉시 저장 (내 정보 탭만 저장 버튼 사용)
function ProfileAppearanceForm({ user, appearance }: { user: MemberDto; appearance: Appearance }) {
  const { save, fileRef, pickFile } = appearance;
  // 이미지 파일을 끌고 놓는 칸 위에 올라와 있는 동안 놓을 자리 표시
  const [dragging, setDragging] = useState(false);
  // 화면 테마는 이 브라우저에만 저장되며 고르면 바로 적용
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const color = user.profileColor ?? userColor(user.id);
  const hasImage = !!user.profileImageUrl;

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
              {dragging ? "여기에 놓으면 바로 올라갑니다." : (
                <>이미지를 끌어다 놓거나{" "}
                  <Anchor component="button" type="button" size="sm" fw={600} disabled={save.isPending}
                    onClick={() => fileRef.current?.click()}>
                    파일 고르기
                  </Anchor>
                </>
              )}
            </Text>
            <Text size="xs" c="dimmed">2MB 이하 PNG, JPG, GIF, WEBP. 이미지가 없으면 이름과 색으로 보입니다.</Text>
          </Stack>
          {hasImage && (
            <Button size="xs" variant="subtle" color="gray" disabled={save.isPending}
              onClick={() => save.mutate(removeProfileImage)}>
              이미지 지우기
            </Button>
          )}
        </Group>
      </Stack>

      <Stack gap={6}>
        {/* 자동 버튼(무작위로 한 색 고름)은 제목 오른쪽 끝 */}
        <Group justify="space-between">
          <Text size="sm" fw={500}>색</Text>
          <Tooltip label="아래 색 중 하나를 자동으로 골라 바꿈" withArrow>
            <Button size="compact-xs" variant="light" disabled={save.isPending}
              onClick={() => { const next = randomColor(color); save.mutate(() => changeProfileColor(next)); }}>
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
              disabled={save.isPending}
              style={{ color: "white", cursor: "pointer" }}
              onClick={() => { if (user.profileColor !== swatch) save.mutate(() => changeProfileColor(swatch)); }}
            >
              {user.profileColor === swatch && <CheckIcon size={12} />}
            </ColorSwatch>
          ))}
        </Group>
      </Stack>

      <Stack gap={6} align="flex-start">
        <Text size="sm" fw={500}>화면 테마</Text>
        <ColorSchemeToggle value={colorScheme} onChange={setColorScheme} />
      </Stack>

    </Stack>
  );
}
