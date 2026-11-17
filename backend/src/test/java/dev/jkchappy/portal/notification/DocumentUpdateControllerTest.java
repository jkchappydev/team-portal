package dev.jkchappy.portal.notification;

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.Mockito.lenient;
import static org.mockito.ArgumentMatchers.anyString;
import org.junit.jupiter.api.BeforeEach;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.notification.dto.DocumentUpdateResponse;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DocumentUpdateController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class})
class DocumentUpdateControllerTest {
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
  private DocumentUpdateService documentUpdateService;

  @MockitoBean
  private MemberService memberService;

  @Test
  void unread_withoutUser_returns401() throws Exception {
    mockMvc.perform(get("/api/notifications/document-updates"))
      .andExpect(status().isUnauthorized())
      .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
  }

  @Test
  void unread_returnsCurrentUsersList() throws Exception {
    when(documentUpdateService.findUnread(1L)).thenReturn(List.of(new DocumentUpdateResponse(3L, 10L, "개발",
      "회의록", null, "동료", OffsetDateTime.parse("2026-11-05T01:00:00Z"), null, "PAGE", null, true)));

    mockMvc.perform(get("/api/notifications/document-updates").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[0].title").value("회의록"))
      .andExpect(jsonPath("$.data[0].updatedByName").value("동료"))
      .andExpect(jsonPath("$.data[0].mentioned").value(true));
  }

  @Test
  void read_marksDocument() throws Exception {
    mockMvc.perform(post("/api/documents/3/read").with(loginAs(1L)))
      .andExpect(status().isOk());
    verify(documentUpdateService).markRead(1L, 3L);
  }

  @Test
  void read_deletedDocument_returns404() throws Exception {
    doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(documentUpdateService).markRead(1L, 3L);
    mockMvc.perform(post("/api/documents/3/read").with(loginAs(1L)))
      .andExpect(status().isNotFound());
  }

  @Test
  void readAll_marksAll() throws Exception {
    mockMvc.perform(post("/api/notifications/document-updates/read-all").with(loginAs(1L)))
      .andExpect(status().isOk());
    verify(documentUpdateService).markAllRead(1L);
  }
}
