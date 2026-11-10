package dev.jkchappy.portal.member;

public enum JobRank {
  HEAD, TEAM_LEAD, RESPONSIBLE, SENIOR,
  // 포털을 만드는 개발자 (루트 관리자 성격): 화면·API로 지정하거나 바꿀 수 없고 DB에서만 설정
  DEVELOPER;

  public boolean isAssignable() {
    return this != DEVELOPER;
  }
}
