package dev.jkchappy.portal.cs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CsBoardClientTest {

  @Test
  void parse_readsDataListAndIgnoresUnknownFields() {
    String json = """
      {"httpStatus":"OK","message":"OK","data":[
        {"boardKey":3,"boardTitle":"로그인 오류","groupName":"A기관","csUserName":"홍길동",
         "managerName":"구슬기","csStatus":"REQS","csStatusName":"요청","createDate":"2026-11-18 10:00:00","extra":"무시"}
      ]}
      """;

    assertThat(CsBoardClient.parse(json))
      .containsExactly(new CsBoardItem(3L, "로그인 오류", "A기관", "홍길동", "구슬기", "REQS", "요청", "2026-11-18 10:00:00"));
  }

  @Test
  void parse_rejectsResponseWithoutData() {
    assertThatThrownBy(() -> CsBoardClient.parse("{\"httpStatus\":\"OK\",\"message\":\"OK\"}"))
      .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void isEnabled_requiresBothUrlAndKey() {
    assertThat(new CsBoardClient("", "key").isEnabled()).isFalse();
    assertThat(new CsBoardClient("http://cs.local", " ").isEnabled()).isFalse();
    assertThat(new CsBoardClient("http://cs.local/", "key").isEnabled()).isTrue();
    assertThat(new CsBoardClient("http://cs.local/", "key").apiUrl()).isEqualTo("http://cs.local");
  }
}
