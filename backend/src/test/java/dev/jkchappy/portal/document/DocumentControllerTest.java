package dev.jkchappy.portal.document;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({DocumentController.class, TrashController.class})
@Import({GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class DocumentControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private DocumentService documentService;

  @MockitoBean
  private MemberService memberService;

  @Test
  void deleteDocument_withoutUser_returns401() throws Exception {
    mockMvc.perform(delete("/api/documents/1"))
      .andExpect(status().isUnauthorized())
      .andExpect(jsonPath("$.error.code").value("USER_NOT_SELECTED"));
  }

  @Test
  void renameDocument_blankTitle_returns400() throws Exception {
    mockMvc.perform(patch("/api/documents/1/title")
        .header("X-User-Id", "1")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"title\":\"\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void changeIcon_tooLong_returns400() throws Exception {
    mockMvc.perform(patch("/api/documents/1/icon")
        .header("X-User-Id", "1")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"" + "a".repeat(33) + "\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void changeIcon_withoutUser_returns401() throws Exception {
    mockMvc.perform(patch("/api/documents/1/icon")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"🚀\"}"))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void changeIcon_returnsDetail() throws Exception {
    when(documentService.changeIcon(1L, "🚀", 1L)).thenReturn(new dev.jkchappy.portal.document.dto.DocumentDetail(
      1L, 10L, "개발", "문서", "🚀", "홍길동", "홍길동", null, false, null, List.of(), "PAGE", null));

    mockMvc.perform(patch("/api/documents/1/icon")
        .header("X-User-Id", "1")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"🚀\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.icon").value("🚀"));
  }

  @Test
  void search_returnsApiResponse() throws Exception {
    when(documentService.search("배포")).thenReturn(List.of());

    mockMvc.perform(get("/api/documents/search").param("q", "배포"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));
  }
}
