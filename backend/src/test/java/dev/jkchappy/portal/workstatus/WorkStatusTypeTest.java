package dev.jkchappy.portal.workstatus;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class WorkStatusTypeTest {

  // 선언 순서가 달력 하루 안 정렬 순서이므로 순서 자체를 고정
  @Test
  void declarationOrder_isDisplaySortOrder() {
    assertThat(WorkStatusType.values()).containsExactly(
      WorkStatusType.LEAVE,
      WorkStatusType.HALF_DAY,
      WorkStatusType.QUARTER_DAY,
      WorkStatusType.OFFICIAL_LEAVE,
      WorkStatusType.BUSINESS_TRIP,
      WorkStatusType.OUTSIDE_WORK,
      WorkStatusType.OTHER);
  }
}
