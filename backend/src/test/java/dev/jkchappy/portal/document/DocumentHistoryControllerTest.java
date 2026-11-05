package dev.jkchappy.portal.document;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.dto.HistoryEntry;
import dev.jkchappy.portal.document.dto.HistoryVersion;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DocumentHistoryController.class)
@Import({GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class})
class DocumentHistoryControllerTest {

  private static final OffsetDateTime AT = OffsetDateTime.parse("2026-11-05T01:00:00Z");

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private DocumentHistoryService documentHistoryService;

  @MockitoBean
  private MemberService memberService;

  @Test
  void list_withoutUser_returns401() throws Exception {
    mockMvc.perform(get("/api/documents/1/history"))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void list_returnsEntries() throws Exception {
    when(documentHistoryService.findHistory(1L))
      .thenReturn(List.of(new HistoryEntry(5L, AT, "김팀원", "AUTO")));

    mockMvc.perform(get("/api/documents/1/history").header("X-User-Id", "1"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[0].id").value(5))
      .andExpect(jsonPath("$.data[0].createdByName").value("김팀원"))
      .andExpect(jsonPath("$.data[0].reason").value("AUTO"));
  }

  @Test
  void get_returnsContentStateAsBase64() throws Exception {
    when(documentHistoryService.getVersion(1L, 5L))
      .thenReturn(new HistoryVersion(5L, AT, null, "AUTO", new byte[] {1, 2, 3}));

    mockMvc.perform(get("/api/documents/1/history/5").header("X-User-Id", "1"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.contentState").value("AQID"));
  }

  @Test
  void checkpoint_decodesBase64() throws Exception {
    when(documentHistoryService.saveCheckpoint(eq(1L), any(), eq(2L)))
      .thenReturn(new HistoryEntry(6L, AT, "김팀원", "BEFORE_RESTORE"));

    mockMvc.perform(post("/api/documents/1/history").header("X-User-Id", "2")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"contentState\":\"AQID\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.reason").value("BEFORE_RESTORE"));
    verify(documentHistoryService).saveCheckpoint(eq(1L), eq(new byte[] {1, 2, 3}), eq(2L));
  }

  @Test
  void checkpoint_emptyContent_returns400() throws Exception {
    mockMvc.perform(post("/api/documents/1/history").header("X-User-Id", "2")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"contentState\":\"\"}"))
      .andExpect(status().isBadRequest());
  }
}
