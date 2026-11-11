import { useQuery } from "@tanstack/react-query";
import { getMe } from "../api/auth";
import type { AuthMe } from "../api/auth";
import type { MemberDto } from "../api/members";

export function useCurrentUser(): { user: MemberDto | null; me: AuthMe | null } {
  const { data: me } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe, retry: false });
  const user = me?.status === "APPROVED" && me.memberId != null && me.memberName != null
    ? {
      id: me.memberId, name: me.memberName, active: true, admin: me.admin, email: me.email,
      profileColor: me.profileColor ?? null, profileImageUrl: me.profileImageUrl ?? null, developer: !!me.developer,
      jobRank: me.jobRank ?? null,
    } : null;
  return { user, me: me ?? null };
}
