import { useRef, useState } from "react";
import { Alert, Avatar, Button, CheckIcon, ColorSwatch, Group, Modal, SimpleGrid, Stack, Text, Tooltip } from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../api/client";
import type { MemberDto } from "../api/members";
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

// 내 설정: 페이지를 볼 때 다른 사람에게 보이는 내 동그라미의 색과 이미지
export function ProfileSettingsModal({ user, opened, onClose }: Props) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const color = user.profileColor ?? userColor(user.id);

  // 저장 결과를 로그인 정보에 바로 반영해 화면 전체가 새 색·이미지를 씀
  const onSaved = (profile: ProfileDto) => {
    setError(null);
    queryClient.setQueryData(["auth", "me"], (me: object | undefined) => me && { ...me, ...profile });
  };
  const onFailed = (e: unknown) => setError(e instanceof ApiError ? e.message : "저장하지 못했습니다.");
  const colorMutation = useMutation({ mutationFn: changeProfileColor, onSuccess: onSaved, onError: onFailed });
  const uploadMutation = useMutation({ mutationFn: uploadProfileImage, onSuccess: onSaved, onError: onFailed });
  const removeMutation = useMutation({ mutationFn: removeProfileImage, onSuccess: onSaved, onError: onFailed });

  const onPickFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      setError("프로필 이미지는 2MB까지 올릴 수 있습니다.");
      return;
    }
    uploadMutation.mutate(file);
  };

  return (
    <Modal opened={opened} onClose={onClose} title="내 설정" centered size="sm">
      <Stack gap="lg">
        <Group gap="md" wrap="nowrap">
          <Avatar
            size={64}
            radius="xl"
            src={user.profileImageUrl}
            aria-label="내 프로필 미리 보기"
            styles={{ placeholder: { background: color, color: "white", fontSize: 20, fontWeight: 600 } }}
          >
            {shortName(user.name)}
          </Avatar>
          <Stack gap={4}>
            <Text fw={600}>{user.name}</Text>
            <Text size="xs" c="dimmed">페이지를 볼 때 다른 사람에게 이렇게 보입니다.</Text>
          </Stack>
        </Group>

        <Stack gap="xs">
          <Text size="sm" fw={500}>프로필 이미지</Text>
          <Group gap="xs">
            <Button size="xs" variant="light" loading={uploadMutation.isPending}
              onClick={() => fileRef.current?.click()}>
              {user.profileImageUrl ? "이미지 바꾸기" : "이미지 올리기"}
            </Button>
            {user.profileImageUrl && (
              <Button size="xs" variant="subtle" color="gray" loading={removeMutation.isPending}
                onClick={() => removeMutation.mutate()}>
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
          <Text size="sm" fw={500}>색</Text>
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
                style={{ color: "white", cursor: "pointer" }}
                onClick={() => colorMutation.mutate(swatch)}
              >
                {user.profileColor === swatch && <CheckIcon size={12} />}
              </ColorSwatch>
            ))}
          </SimpleGrid>
          <Group gap="xs">
            <Tooltip label="위 색 중 하나를 무작위로 고름" withArrow>
              <Button size="compact-xs" variant="light" color="gray"
                onClick={() => colorMutation.mutate(randomColor(color))}>
                랜덤
              </Button>
            </Tooltip>
          </Group>
        </Stack>

        {error && <Alert color="red" p="xs">{error}</Alert>}
      </Stack>
    </Modal>
  );
}
