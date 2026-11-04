import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listMembers } from "../api/members";
import type { MemberDto } from "../api/members";

const STORAGE_KEY = "portal.userId";

// 저장된 사용자 ID 조회 (저장소 접근 오류는 미선택으로 처리)
export function getStoredUserId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const id = Number(raw);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

export function setStoredUserId(id: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // 저장 실패 시 이번 세션에서만 사용
  }
}

export function clearStoredUserId(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}

// 현재 선택된 팀원 정보를 제공하는 훅
export function useCurrentUser(): { user: MemberDto | null; select: (id: number) => void; clear: () => void } {
  const [userId, setUserId] = useState<number | null>(getStoredUserId);
  const { data: members } = useQuery({ queryKey: ["members", false], queryFn: () => listMembers(false) });

  // apiFetch가 USER_NOT_SELECTED를 받으면 선택 상태를 해제
  useEffect(() => {
    const onCleared = () => setUserId(null);
    window.addEventListener("portal:user-cleared", onCleared);
    return () => window.removeEventListener("portal:user-cleared", onCleared);
  }, []);

  const select = useCallback((id: number) => {
    setStoredUserId(id);
    setUserId(id);
  }, []);

  const clear = useCallback(() => {
    clearStoredUserId();
    setUserId(null);
  }, []);

  const user = userId === null ? null : (members?.find((m) => m.id === userId) ?? null);
  // 목록 로딩 전에는 선택 유지, 목록에 없거나 비활성이면 미선택 취급
  return { user, select, clear };
}
