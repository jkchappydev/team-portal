package dev.jkchappy.portal.document;

// 본문 사본 종류
public enum SnapshotReason {
  // 협업 저장 중 10분 간격 자동 사본
  AUTO,
  // 이전 버전으로 되돌리기 직전의 본문
  BEFORE_RESTORE
}
