package dev.jkchappy.portal.cs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.cs.dto.NewCsListResponse;
import dev.jkchappy.portal.cs.dto.NewCsResponse;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;

class CsServiceTest {

  private final CsBoardClient client = mock(CsBoardClient.class);

  @Test
  void findNew_returnsNotConfiguredWithoutCallingApi() {
    when(client.isEnabled()).thenReturn(false);

    NewCsListResponse result = new CsService(client, "").findNew();

    assertThat(result.configured()).isFalse();
    assertThat(result.items()).isEmpty();
    verify(client, never()).fetchNew(anyInt());
  }

  @Test
  void findNew_mapsItemsWithKstTimeAndDetailUrl() {
    when(client.isEnabled()).thenReturn(true);
    when(client.fetchNew(CsService.NEW_CS_LIMIT)).thenReturn(List.of(
      new CsBoardItem(3L, "로그인 오류", "A기관", "홍길동", "2026-11-18 10:00:00"),
      new CsBoardItem(2L, "날짜 없음", "B기관", "김철수", "잘못된 값")));

    NewCsListResponse result = new CsService(client, "https://cs.example.com/").findNew();

    assertThat(result.configured()).isTrue();
    assertThat(result.items()).containsExactly(
      new NewCsResponse(3L, "로그인 오류", "A기관", "홍길동",
        OffsetDateTime.of(2026, 11, 18, 10, 0, 0, 0, ZoneOffset.ofHours(9)),
        "https://cs.example.com/detail?boardKey=3"),
      new NewCsResponse(2L, "날짜 없음", "B기관", "김철수", null,
        "https://cs.example.com/detail?boardKey=2"));
  }

  @Test
  void findNew_usesApiUrlForDetailWhenWebUrlIsBlank() {
    when(client.isEnabled()).thenReturn(true);
    when(client.apiUrl()).thenReturn("http://localhost:1031");
    when(client.fetchNew(CsService.NEW_CS_LIMIT)).thenReturn(List.of(
      new CsBoardItem(7L, "문의", "A기관", "홍길동", "2026-11-18 10:00:00")));

    NewCsListResponse result = new CsService(client, " ").findNew();

    assertThat(result.items().getFirst().detailUrl()).isEqualTo("http://localhost:1031/detail?boardKey=7");
  }

  @Test
  void findNew_throwsCsUnavailableWhenApiFails() {
    when(client.isEnabled()).thenReturn(true);
    when(client.fetchNew(CsService.NEW_CS_LIMIT)).thenThrow(new IllegalStateException("CS API HTTP 401"));

    assertThatThrownBy(() -> new CsService(client, "").findNew())
      .isInstanceOf(BusinessException.class)
      .extracting(e -> ((BusinessException) e).getErrorCode())
      .isEqualTo(ErrorCode.CS_UNAVAILABLE);
  }
}
