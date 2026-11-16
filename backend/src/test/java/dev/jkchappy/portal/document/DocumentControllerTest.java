package dev.jkchappy.portal.document;

import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class DocumentControllerTest {
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
  private DocumentService documentService;

  @MockitoBean
  private MemberService memberService;

  @MockitoBean
  private TrashService trashService;

  @Test
  void deleteDocument_withoutUser_returns401() throws Exception {
    mockMvc.perform(delete("/api/documents/1"))
      .andExpect(status().isUnauthorized())
      .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
  }

  @Test
  void renameDocument_blankTitle_returns400() throws Exception {
    mockMvc.perform(patch("/api/documents/1/title")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"title\":\"\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void changeIcon_tooLong_returns400() throws Exception {
    mockMvc.perform(patch("/api/documents/1/icon")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"" + "a".repeat(513) + "\"}"))
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
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"🚀\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.icon").value("🚀"));
  }

  // 메인 화면 새 게시글은 10개까지 (주소 recent가 문서 번호 자리로 해석되지 않음)
  @Test
  void recent_returnsLatestTen() throws Exception {
    when(documentService.findRecent(10)).thenReturn(List.of());

    mockMvc.perform(get("/api/documents/recent"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));
  }

  @Test
  void search_returnsApiResponse() throws Exception {
    when(documentService.search("배포")).thenReturn(List.of());

    mockMvc.perform(get("/api/documents/search").param("q", "배포"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));
  }

  @Test
  void purgeDocument_callsTrashService() throws Exception {
    mockMvc.perform(delete("/api/trash/documents/3").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));

    verify(trashService).purgeDocument(3L);
  }

  @Test
  void purgeSpace_callsTrashService() throws Exception {
    mockMvc.perform(delete("/api/trash/spaces/9").with(loginAs(1L)))
      .andExpect(status().isOk());

    verify(trashService).purgeSpace(9L);
  }

  @Test
  void purgeDocument_notInTrash_returns400() throws Exception {
    doThrow(new BusinessException(ErrorCode.INVALID_INPUT, "휴지통에 있는 페이지만 영구 삭제할 수 있습니다."))
      .when(trashService).purgeDocument(3L);

    mockMvc.perform(delete("/api/trash/documents/3").with(loginAs(1L)))
      .andExpect(status().isBadRequest());
  }

  @Test
  void purgeDocument_withoutUser_returns401() throws Exception {
    mockMvc.perform(delete("/api/trash/documents/3"))
      .andExpect(status().isUnauthorized());
  }
}
