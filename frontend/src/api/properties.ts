import { apiFetch } from "./client";

// 페이지 속성 종류 (값은 글: 사람은 팀원 id를 쉼표로, 날짜는 YYYY-MM-DD, 체크박스는 "true")
export type PropertyType = "PERSON" | "TEXT" | "NUMBER" | "DATE" | "CHECKBOX" | "URL";

export interface PropertyDto {
  id: number;
  name: string;
  type: PropertyType;
  // 비어 있으면 null
  value: string | null;
}

export const propertiesKey = (documentId: number) => ["properties", documentId] as const;

// 처음 열면 서버가 기본 속성(담당자)을 만들어 돌려줌
export function listProperties(documentId: number): Promise<PropertyDto[]> {
  return apiFetch<PropertyDto[]>(`/api/documents/${documentId}/properties`);
}

export function createProperty(documentId: number, name: string, type: PropertyType): Promise<PropertyDto> {
  return apiFetch<PropertyDto>(`/api/documents/${documentId}/properties`, { method: "POST", body: JSON.stringify({ name, type }) });
}

export function renameProperty(documentId: number, propertyId: number, name: string): Promise<PropertyDto> {
  return apiFetch<PropertyDto>(`/api/documents/${documentId}/properties/${propertyId}/name`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function changePropertyValue(documentId: number, propertyId: number, value: string | null): Promise<PropertyDto> {
  return apiFetch<PropertyDto>(`/api/documents/${documentId}/properties/${propertyId}/value`, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

// index: 옮긴 뒤 목록에서의 위치 (0부터), 바뀐 전체 순서를 돌려줌
export function moveProperty(documentId: number, propertyId: number, index: number): Promise<PropertyDto[]> {
  return apiFetch<PropertyDto[]>(`/api/documents/${documentId}/properties/${propertyId}/order`, {
    method: "PATCH",
    body: JSON.stringify({ index }),
  });
}

export function deleteProperty(documentId: number, propertyId: number): Promise<void> {
  return apiFetch<void>(`/api/documents/${documentId}/properties/${propertyId}`, { method: "DELETE" });
}
