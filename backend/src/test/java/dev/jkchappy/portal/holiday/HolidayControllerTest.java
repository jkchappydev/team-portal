package dev.jkchappy.portal.holiday;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.holiday.dto.HolidayResponse;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(HolidayController.class)
@Import({GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class HolidayControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private HolidayService holidayService;

  @MockitoBean
  private MemberService memberService;

  @Test
  void list_returnsHolidayResponse() throws Exception {
    when(holidayService.findByMonth(YearMonth.of(2026, 6))).thenReturn(List.of(
      new HolidayResponse(LocalDate.of(2026, 6, 3), "전국동시지방선거")));

    mockMvc.perform(get("/api/holidays").param("year", "2026").param("month", "6"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[0].date").value("2026-06-03"))
      .andExpect(jsonPath("$.data[0].name").value("전국동시지방선거"));
  }

  @Test
  void list_invalidMonth_returns400() throws Exception {
    mockMvc.perform(get("/api/holidays").param("year", "2026").param("month", "13"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }
}
