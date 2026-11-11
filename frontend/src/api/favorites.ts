import { apiFetch } from "./client";
import type { DocumentKind } from "./documents";

// 즐겨찾기 한 줄 (home: 프로젝트 본문 페이지면 true, 이때 title은 프로젝트 이름)
export interface FavoriteDto {
  documentId: number;
  spaceId: number;
  title: string;
  icon: string | null;
  kind: DocumentKind;
  home: boolean;
}

export const FAVORITES_KEY = ["favorites"] as const;

// 바꾸는 요청은 모두 바뀐 뒤의 전체 목록을 돌려줌
export function listFavorites(): Promise<FavoriteDto[]> {
  return apiFetch<FavoriteDto[]>("/api/me/favorites");
}

export function addFavorite(documentId: number): Promise<FavoriteDto[]> {
  return apiFetch<FavoriteDto[]>(`/api/me/favorites/${documentId}`, { method: "PUT" });
}

export function removeFavorite(documentId: number): Promise<FavoriteDto[]> {
  return apiFetch<FavoriteDto[]>(`/api/me/favorites/${documentId}`, { method: "DELETE" });
}

export function moveFavorite(documentId: number, index: number): Promise<FavoriteDto[]> {
  return apiFetch<FavoriteDto[]>(`/api/me/favorites/${documentId}/order`, {
    method: "PATCH", body: JSON.stringify({ index }),
  });
}

// 즐겨찾기 줄을 누르면 갈 화면 (프로젝트 본문은 프로젝트 주소)
export function favoritePath(favorite: FavoriteDto): string {
  if (favorite.home) return `/spaces/${favorite.spaceId}`;
  if (favorite.kind === "FILE") return `/files/${favorite.documentId}`;
  if (favorite.kind === "WBS") return `/wbs/${favorite.documentId}`;
  return `/documents/${favorite.documentId}`;
}
