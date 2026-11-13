package dev.jkchappy.portal.workstatus;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import dev.jkchappy.portal.workstatus.dto.WorkStatusNoticeList;
import dev.jkchappy.portal.workstatus.dto.WorkStatusNoticeResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WorkStatusNoticeController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class})
class WorkStatusNoticeControllerTest {

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private WorkStatusNoticeService noticeService;

  @MockitoBean
  private MemberService memberService;

  @Autowired
  private MockMvc mockMvc;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }

  @Test
  void unread_returnsCurrentUsersNotices() throws Exception {
    when(noticeService.findUnread(1L)).thenReturn(new WorkStatusNoticeList(true, List.of(
      new WorkStatusNoticeResponse(7L, WorkStatusAction.UPDATED, "홍길동 연차", LocalDate.of(2026, 11, 20),
        LocalDate.of(2026, 11, 20), "김팀원", Instant.parse("2026-11-13T01:00:00Z")))));

    mockMvc.perform(get("/api/notifications/work-status").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.enabled").value(true))
      .andExpect(jsonPath("$.data.items[0].label").value("홍길동 연차"))
      .andExpect(jsonPath("$.data.items[0].action").value("UPDATED"))
      .andExpect(jsonPath("$.data.items[0].startDate").value("2026-11-20"));
  }

  @Test
  void unread_withoutUser_returns401() throws Exception {
    mockMvc.perform(get("/api/notifications/work-status"))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void read_andReadAll_markForCurrentUser() throws Exception {
    mockMvc.perform(post("/api/notifications/work-status/7/read").with(loginAs(1L)))
      .andExpect(status().isOk());
    verify(noticeService).markRead(1L, 7L);

    mockMvc.perform(post("/api/notifications/work-status/read-all").with(loginAs(1L)))
      .andExpect(status().isOk());
    verify(noticeService).markAllRead(1L);
  }
}
