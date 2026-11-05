package dev.jkchappy.portal.account.dto;

import dev.jkchappy.portal.account.AccountStatus;

// active: 승인됐지만 비활성으로 바뀐 팀원이면 false (화면이 "접근 권한이 없습니다" 표시)
public record AuthMeResponse(String email, AccountStatus status, Long memberId, String memberName, boolean admin,
  boolean active) {}
