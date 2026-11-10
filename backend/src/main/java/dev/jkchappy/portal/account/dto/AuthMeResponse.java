package dev.jkchappy.portal.account.dto;

import dev.jkchappy.portal.account.AccountStatus;

// active: 승인됐지만 비활성으로 바뀐 팀원이면 false (화면이 "접근 권한이 없습니다" 표시)
// profileComplete: 부서·직급을 아직 입력하지 않았으면 false (화면이 내 정보 입력 화면 표시)
// profileColor·profileImageUrl: 본인이 고른 프로필 색·이미지 (없으면 null)
public record AuthMeResponse(String email, AccountStatus status, Long memberId, String memberName, boolean admin,
  boolean active, boolean profileComplete, String profileColor, String profileImageUrl) {}
