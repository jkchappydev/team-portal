import { apiFetch } from "./client";

// 회사 밖 업체 담당자 연락처 (팀 공용)
export interface ContactDto {
  id: number;
  name: string;
  // 비어 있으면 null
  company: string | null;
  email: string | null;
  phone: string | null;
  // 연관 프로젝트 이름 (없으면 빈 목록)
  projects: string[];
}

export interface ContactRequest {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  projects: string[];
}

export const CONTACTS_KEY = ["contacts"];

export function listContacts(): Promise<ContactDto[]> {
  return apiFetch<ContactDto[]>("/api/contacts");
}

export function createContact(body: ContactRequest): Promise<ContactDto> {
  return apiFetch<ContactDto>("/api/contacts", { method: "POST", body: JSON.stringify(body) });
}

export function updateContact(id: number, body: ContactRequest): Promise<ContactDto> {
  return apiFetch<ContactDto>(`/api/contacts/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

// 끌어 옮긴 연락처를 index 위치로 (0이 맨 위)
export function moveContact(id: number, index: number): Promise<void> {
  return apiFetch<void>(`/api/contacts/${id}/position`, { method: "PATCH", body: JSON.stringify({ index }) });
}

export function deleteContact(id: number): Promise<void> {
  return apiFetch<void>(`/api/contacts/${id}`, { method: "DELETE" });
}
