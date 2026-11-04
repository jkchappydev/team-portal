import { apiFetch } from "./client";

export interface SpaceDto {
  id: number;
  name: string;
  description: string | null;
  documentCount: number;
}

export function listSpaces(): Promise<SpaceDto[]> {
  return apiFetch<SpaceDto[]>("/api/spaces");
}

export function createSpace(name: string, description?: string): Promise<SpaceDto> {
  return apiFetch<SpaceDto>("/api/spaces", { method: "POST", body: JSON.stringify({ name, description }) });
}

export function updateSpace(id: number, name: string, description?: string): Promise<SpaceDto> {
  return apiFetch<SpaceDto>(`/api/spaces/${id}`, { method: "PATCH", body: JSON.stringify({ name, description }) });
}

export function deleteSpace(id: number): Promise<void> {
  return apiFetch<void>(`/api/spaces/${id}`, { method: "DELETE" });
}

export function restoreSpace(id: number): Promise<void> {
  return apiFetch<void>(`/api/spaces/${id}/restore`, { method: "POST" });
}
