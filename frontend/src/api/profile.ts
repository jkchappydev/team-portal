import { apiFetch } from "./client";

// profileColor: 본인이 고른 색 (null이면 자동 색), profileImageUrl: 프로필 이미지 주소 (null이면 없음)
export interface ProfileDto {
  profileColor: string | null;
  profileImageUrl: string | null;
}

// null이면 자동 색으로 되돌림
export function changeProfileColor(color: string | null): Promise<ProfileDto> {
  return apiFetch<ProfileDto>("/api/me/profile/color", { method: "PUT", body: JSON.stringify({ color }) });
}

export function uploadProfileImage(file: File): Promise<ProfileDto> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<ProfileDto>("/api/me/profile/image", { method: "POST", body: form });
}

export function removeProfileImage(): Promise<ProfileDto> {
  return apiFetch<ProfileDto>("/api/me/profile/image", { method: "DELETE" });
}
