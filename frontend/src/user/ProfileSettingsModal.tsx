import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Avatar, Button, CheckIcon, ColorSwatch, Box, Group, Modal, NavLink, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { ColorSchemeToggle } from "../layout/ColorSchemeToggle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import { listMembers } from "../api/members";
import type { MemberDto } from "../api/members";
import { MemberInfoForm } from "../members/MemberInfoForm";
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

type SettingsTab = "info" | "profile";
const SETTINGS_TABS: { value: SettingsTab; label: string }[] = [
  { value: "info", label: "개인정보 수정" }, { value: "profile", label: "내 설정" },
];

// 내 설정 창: 왼쪽 탭으로 개인정보 수정과 내 설정(프로필 모양)을 나눔
export function ProfileSettingsModal({ user, opened, onClose }: Props) {
  const queryClient = useQueryClient();
  // 내 부서·직급·연락처는 팀원 목록에서 가져옴
  const { data: members } = useQuery({ queryKey: ["members", true], queryFn: () => listMembers(true), enabled: opened });
  const myInfo = members?.find((member) => member.id === user.id);
  const [infoSaved, setInfoSaved] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("info");

  return (
    <Modal opened={opened} onClose={onClose} title="내 설정" centered size="lg">
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
          {/* 가입 때 입력한 부서·직급·연락처 (최초 가입 정보 입력 화면과 같은 양식) */}
          <Stack gap="xs">
            {myInfo ? (
              <MemberInfoForm
                key={`${myInfo.department}-${myInfo.jobRank}-${myInfo.phone}-${myInfo.extension}`}
                member={myInfo}
                submitLabel="저장"
                onSaved={() => {
                  setInfoSaved(true);
                  void queryClient.invalidateQueries({ queryKey: ["members"] });
                  // 사이드바 이름 옆 직급도 바로 바뀌도록 로그인 정보 다시 조회
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
      </Group>
    </Modal>
  );
}

// 페이지를 볼 때 다른 사람에게 보이는 내 동그라미의 색과 이미지
// 개인정보 수정과 같게, 고른 내용은 미리 보기에만 반영하고 저장을 눌러야 서버에 저장
function ProfileAppearanceForm({ user }: { user: MemberDto }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // 저장 전 고른 값 (undefined = 그대로)
  const [draftColor, setDraftColor] = useState<string | undefined>(undefined);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftRemove, setDraftRemove] = useState(false);

  // 고른 이미지 파일을 미리 보기 주소로 만들고, 바뀌면 이전 주소를 해제
  const draftFileUrl = useMemo(
    () => (draftFile && typeof URL.createObjectURL === "function" ? URL.createObjectURL(draftFile) : null),
    [draftFile],
  );
  useEffect(() => () => { if (draftFileUrl) URL.revokeObjectURL(draftFileUrl); }, [draftFileUrl]);

  const pickedColor = draftColor ?? user.profileColor ?? null;
  const color = pickedColor ?? userColor(user.id);
  const imageUrl = draftFile ? draftFileUrl : draftRemove ? null : user.profileImageUrl;
  const hasImage = !!draftFile || (!draftRemove && !!user.profileImageUrl);
  const dirty = draftColor !== undefined || !!draftFile || draftRemove;

  const edit = () => { setSaved(false); setError(null); };

  // 이미지 → 색 순서로 저장하고 마지막 결과를 로그인 정보에 반영해 화면 전체가 새 색·이미지를 씀
  const save = useMutation({
    mutationFn: async () => {
      let profile: ProfileDto | null = null;
      if (draftFile) profile = await uploadProfileImage(draftFile);
      else if (draftRemove) profile = await removeProfileImage();
      if (draftColor !== undefined) profile = await changeProfileColor(draftColor);
      return profile;
    },
    onSuccess: (profile) => {
      if (profile) queryClient.setQueryData(["auth", "me"], (me: object | undefined) => me && { ...me, ...profile });
      setDraftColor(undefined);
      setDraftFile(null);
      setDraftRemove(false);
      setSaved(true);
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : "저장하지 못했습니다."),
  });

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    edit();
    if (file.size > MAX_IMAGE_BYTES) {
      setError("프로필 이미지는 2MB까지 올릴 수 있습니다.");
      return;
    }
    setDraftFile(file);
    setDraftRemove(false);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
      style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Stack gap="lg">
        <Group gap="md" wrap="nowrap">
          <Avatar
            size={64}
            radius="xl"
            src={imageUrl}
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

        <Stack gap="xs">
          <Text size="sm" fw={500}>프로필 이미지</Text>
          <Group gap="xs">
            <Button size="xs" variant="light" onClick={() => fileRef.current?.click()}>
              {hasImage ? "이미지 바꾸기" : "이미지 올리기"}
            </Button>
            {hasImage && (
              <Button size="xs" variant="subtle" color="gray"
                onClick={() => { edit(); setDraftFile(null); setDraftRemove(!!user.profileImageUrl); }}>
                이미지 지우기
              </Button>
            )}
          </Group>
          <Text size="xs" c="dimmed">2MB 이하 PNG, JPG, GIF, WEBP. 이미지가 없으면 이름과 색으로 보입니다.</Text>
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
          {/* 랜덤 버튼은 제목 오른쪽 */}
          <Group gap="xs">
            <Text size="sm" fw={500}>색</Text>
            <Tooltip label="아래 색 중 하나를 무작위로 고름" withArrow>
              <Button size="compact-xs" variant="light" color="gray"
                onClick={() => { edit(); setDraftColor(randomColor(color)); }}>
                랜덤
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
                aria-pressed={pickedColor === swatch}
                style={{ color: "white", cursor: "pointer" }}
                onClick={() => { edit(); setDraftColor(swatch); }}
              >
                {pickedColor === swatch && <CheckIcon size={12} />}
              </ColorSwatch>
            ))}
          </SimpleGrid>
        </Stack>

        {/* 화면 테마는 이 브라우저에만 저장되어 저장 버튼 없이 바로 적용 */}
        <Stack gap="xs">
          <Text size="sm" fw={500}>화면 테마</Text>
          <ColorSchemeToggle />
        </Stack>

        {error && <Alert color="red" p="xs">{error}</Alert>}
      </Stack>
      {/* 저장 버튼은 칸 맨 아래에 붙이고, 내용이 넘쳐 스크롤해도 아래에 보이게 고정 */}
      <Stack gap="xs" pt="md" mt="auto"
        style={{ position: "sticky", bottom: 0, background: "var(--mantine-color-body)" }}>
        <Group justify="flex-end">
          <Button type="submit" loading={save.isPending} disabled={!dirty}>저장</Button>
        </Group>
        {saved && <Text size="xs" c="teal" ta="right">저장했습니다.</Text>}
      </Stack>
    </form>
  );
}
