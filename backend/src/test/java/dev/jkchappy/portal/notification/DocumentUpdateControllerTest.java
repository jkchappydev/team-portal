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
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.document.dto.DocumentSummary;
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
@Import({GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class})
class DocumentUpdateControllerTest {

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
      .andExpect(jsonPath("$.error.code").value("USER_NOT_SELECTED"));
  }

  @Test
  void unread_returnsCurrentUsersList() throws Exception {
    when(documentUpdateService.findUnread(1L)).thenReturn(List.of(new DocumentSummary(3L, 10L, "개발",
      "회의록", null, "동료", OffsetDateTime.parse("2026-11-05T01:00:00Z"), null, "PAGE", null)));

    mockMvc.perform(get("/api/notifications/document-updates").header("X-User-Id", "1"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[0].title").value("회의록"))
      .andExpect(jsonPath("$.data[0].updatedByName").value("동료"));
  }

  @Test
  void read_marksDocument() throws Exception {
    mockMvc.perform(post("/api/documents/3/read").header("X-User-Id", "1"))
      .andExpect(status().isOk());
    verify(documentUpdateService).markRead(1L, 3L);
  }

  @Test
  void read_deletedDocument_returns404() throws Exception {
    doThrow(new BusinessException(ErrorCode.NOT_FOUND)).when(documentUpdateService).markRead(1L, 3L);
    mockMvc.perform(post("/api/documents/3/read").header("X-User-Id", "1"))
      .andExpect(status().isNotFound());
  }

  @Test
  void readAll_marksAll() throws Exception {
    mockMvc.perform(post("/api/notifications/document-updates/read-all").header("X-User-Id", "1"))
      .andExpect(status().isOk());
    verify(documentUpdateService).markAllRead(1L);
  }
}
