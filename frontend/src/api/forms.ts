import { apiFetch } from "./client";

// 팀 스페이스 "양식"에 올려 두는 문서 양식 파일 (팀 공용)
export interface FormDto {
  id: number;
  // 올린 파일 이름 (확장자 포함)
  name: string;
  contentType: string;
  size: number;
  uploadedByName: string;
  // 올린 시각 (ISO)
  createdAt: string;
  // 미리보기와 다운로드에 쓰는 파일 주소
  url: string;
}

export const FORMS_KEY = ["forms"];

export function listForms(): Promise<FormDto[]> {
  return apiFetch<FormDto[]>("/api/forms");
}

// multipart 업로드 (Content-Type은 브라우저가 경계값과 함께 지정)
export function uploadForm(file: File): Promise<FormDto> {
  const form = new FormData();
  form.append("file", file);
  return apiFetch<FormDto>("/api/forms", { method: "POST", body: form });
}

// 끌어 옮긴 양식을 index 위치로 (0이 맨 위)
export function moveForm(id: number, index: number): Promise<void> {
  return apiFetch<void>(`/api/forms/${id}/position`, { method: "PATCH", body: JSON.stringify({ index }) });
}

export function deleteForm(id: number): Promise<void> {
  return apiFetch<void>(`/api/forms/${id}`, { method: "DELETE" });
}
