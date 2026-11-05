package dev.jkchappy.portal.annualleave;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.annualleave.dto.AnnualLeaveSummaryResponse;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.Mockito.lenient;
import static org.mockito.ArgumentMatchers.anyString;
import org.junit.jupiter.api.BeforeEach;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AnnualLeaveController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class})
class AnnualLeaveControllerTest {
  @MockitoBean
  private AccountService accountService;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }


  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private AnnualLeaveService annualLeaveService;

  @MockitoBean
  private MemberService memberService;

  @Test
  void list_returnsAnnualLeaveSummary() throws Exception {
    when(annualLeaveService.findByYear(2026)).thenReturn(List.of(new AnnualLeaveSummaryResponse(
      1L, "홍길동", new BigDecimal("15"), BigDecimal.ZERO, new BigDecimal("15"),
      new BigDecimal("1.75"), new BigDecimal("13.25"),
      List.of(new dev.jkchappy.portal.annualleave.dto.WeeklyLeaveUsage(11, 2, new BigDecimal("1.75"))), true)));

    mockMvc.perform(get("/api/annual-leaves").param("year", "2026"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[0].usedDays").value(1.75))
      .andExpect(jsonPath("$.data[0].remainingDays").value(13.25))
      .andExpect(jsonPath("$.data[0].weeklyUsages[0].month").value(11))
      .andExpect(jsonPath("$.data[0].weeklyUsages[0].week").value(2));
  }

  @Test
  void update_withoutUserHeader_returns401() throws Exception {
    mockMvc.perform(put("/api/annual-leaves/1").param("year", "2026")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"confirmedDays\":15,\"carriedDays\":0}"))
      .andExpect(status().isUnauthorized())
      .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
  }

  @Test
  void update_negativeDays_returns400() throws Exception {
    mockMvc.perform(put("/api/annual-leaves/1").param("year", "2026")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"confirmedDays\":-1,\"carriedDays\":0}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }
}
