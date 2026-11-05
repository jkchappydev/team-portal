import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "./currentUser";

// 관리자 전용 화면: 관리자가 아니면 주소로 직접 들어와도 첫 화면으로 돌려보냄
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  if (!user) return null;
  if (!user.admin) return <Navigate to="/work-status" replace />;
  return <>{children}</>;
}
