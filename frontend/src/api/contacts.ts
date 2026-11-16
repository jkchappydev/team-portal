import { apiFetch } from "./client";

// 회사 밖 업체 담당자 연락처 (팀 공용)
export interface ContactDto {
  id: number;
  name: string;
  // 비어 있으면 null
  company: string | null;
  email: string | null;
  // 전화번호 1
  phone: string | null;
  phone2: string | null;
  // 연관 프로젝트 (정해진 이름이 없어 자유 입력 글)
  project: string | null;
  memo: string | null;
  // 카드 이름 동그라미 색 (#RRGGBB, null이면 자동 색)
  color: string | null;
}

export interface ContactRequest {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  project: string | null;
  memo: string | null;
  // 카드 이름 동그라미 색 (#RRGGBB, null이면 자동 색)
  color: string | null;
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

export function deleteContact(id: number): Promise<void> {
  return apiFetch<void>(`/api/contacts/${id}`, { method: "DELETE" });
}

