import { apiFetch } from "./client";

export interface AttachmentDto {
  id: number;
  originalName: string;
  contentType: string;
  size: number;
  uploadedByName: string | null;
  createdAt: string;
  url: string;
}

// multipart 업로드 (Content-Type은 브라우저가 경계값과 함께 지정)
export function uploadAttachment(documentId: number, file: File, inline = false): Promise<AttachmentDto> {
  const form = new FormData();
  form.append("file", file);
  form.append("inline", String(inline));
  return apiFetch<AttachmentDto>(`/api/documents/${documentId}/attachments`, { method: "POST", body: form });
}
