package dev.jkchappy.portal.holiday;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PublicDataHolidayClientTest {

  @Test
  void parse_includesOnlyPublicHolidays() throws Exception {
    String xml = """
      <response><header><resultCode>00</resultCode></header><body><items>
        <item><dateName>전국동시지방선거</dateName><isHoliday>Y</isHoliday><locdate>20260603</locdate></item>
        <item><dateName>기념일</dateName><isHoliday>N</isHoliday><locdate>20260610</locdate></item>
      </items></body></response>
      """;

    assertThat(PublicDataHolidayClient.parse(xml))
      .containsExactly(new HolidayData(LocalDate.of(2026, 6, 3), "전국동시지방선거"));
  }
}
