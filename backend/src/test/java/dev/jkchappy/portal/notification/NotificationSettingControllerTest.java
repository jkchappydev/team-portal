package dev.jkchappy.portal.notification;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.notification.dto.NotificationSettingResponse;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(NotificationSettingController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class})
class NotificationSettingControllerTest {

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private NotificationSettingService notificationSettingService;

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
  void list_withoutUser_returns401() throws Exception {
    mockMvc.perform(get("/api/me/notification-settings"))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void list_returnsMySettings() throws Exception {
    when(notificationSettingService.findMine(1L)).thenReturn(List.of(
      new NotificationSettingResponse(3L, NotificationLevel.ALL),
      new NotificationSettingResponse(4L, NotificationLevel.MENTION)));

    mockMvc.perform(get("/api/me/notification-settings").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[1].spaceId").value(4))
      .andExpect(jsonPath("$.data[1].level").value("MENTION"));
  }

  @Test
  void change_savesForCurrentUser() throws Exception {
    when(notificationSettingService.change(1L, 4L, NotificationLevel.OFF))
      .thenReturn(new NotificationSettingResponse(4L, NotificationLevel.OFF));

    mockMvc.perform(put("/api/me/notification-settings/4").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"level\":\"OFF\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.level").value("OFF"));
  }

  @Test
  void change_unknownLevel_returns400() throws Exception {
    mockMvc.perform(put("/api/me/notification-settings/4").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"level\":\"SOMETIMES\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void change_deletedProject_returns404() throws Exception {
    when(notificationSettingService.change(1L, 4L, NotificationLevel.OFF))
      .thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(put("/api/me/notification-settings/4").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"level\":\"OFF\"}"))
      .andExpect(status().isNotFound());
  }
}
