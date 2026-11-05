package dev.jkchappy.portal.document;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.collab.CollabTicketService;
import java.util.Optional;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.Mockito.lenient;
import static org.mockito.ArgumentMatchers.anyString;
import org.junit.jupiter.api.BeforeEach;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberService;
import java.util.Base64;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(InternalCollabController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class})
@TestPropertySource(properties = "app.internal-token=test-token")
class InternalCollabControllerTest {
  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private CollabTicketService tickets;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(tickets.consume("ticket")).thenReturn(Optional.of(2L));
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }


  private static final String TOKEN_HEADER = "X-Internal-Token";

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private DocumentService documentService;

  @MockitoBean
  private MemberService memberService;

  @Test
  void request_withoutToken_returns403() throws Exception {
    mockMvc.perform(get("/internal/documents/1/content"))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.success").value(false))
      .andExpect(jsonPath("$.error.code").value("FORBIDDEN"));
  }

  @Test
  void request_withWrongToken_returns403() throws Exception {
    mockMvc.perform(get("/internal/documents/1/content").header(TOKEN_HEADER, "wrong"))
      .andExpect(status().isForbidden());
  }

  @Test
  void authorize_deletedDocument_returns404() throws Exception {
    when(documentService.getLiveDocument(1L)).thenThrow(new BusinessException(ErrorCode.NOT_FOUND));

    mockMvc.perform(get("/internal/collab/authorize")
        .param("documentId", "1").param("ticket", "ticket").header(TOKEN_HEADER, "test-token"))
      .andExpect(status().isNotFound());
  }

  @Test
  void authorize_inactiveUser_returns401() throws Exception {
    when(memberService.getActiveMember(2L))
      .thenThrow(new BusinessException(ErrorCode.MEMBER_INACTIVE));

    mockMvc.perform(get("/internal/collab/authorize")
        .param("documentId", "1").param("ticket", "ticket").header(TOKEN_HEADER, "test-token"))
      .andExpect(status().isForbidden());
  }

  @Test
  void authorize_validUser_returnsUserName() throws Exception {
    when(memberService.getActiveMember(2L)).thenReturn(Member.create("홍길동"));

    mockMvc.perform(get("/internal/collab/authorize")
        .param("documentId", "1").param("ticket", "ticket").header(TOKEN_HEADER, "test-token"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.userName").value("홍길동"));
  }

  @Test
  void getContent_returnsBase64State() throws Exception {
    Document doc = Document.create(10L, "문서", 1L);
    doc.updateContent(new byte[] {1, 2, 3}, "본문", 1L);
    when(documentService.getLiveDocument(1L)).thenReturn(doc);

    mockMvc.perform(get("/internal/documents/1/content").header(TOKEN_HEADER, "test-token"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.state").value(Base64.getEncoder().encodeToString(new byte[] {1, 2, 3})));
  }

  @Test
  void getContent_noState_returnsNull() throws Exception {
    when(documentService.getLiveDocument(1L)).thenReturn(Document.create(10L, "문서", 1L));

    mockMvc.perform(get("/internal/documents/1/content").header(TOKEN_HEADER, "test-token"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.state").doesNotExist());
  }

  @Test
  void putContent_decodesBase64AndSaves() throws Exception {
    byte[] bytes = {1, 2, 3};
    String body = "{\"state\":\"" + Base64.getEncoder().encodeToString(bytes)
      + "\",\"plainText\":\"본문\",\"updatedBy\":3}";

    mockMvc.perform(put("/internal/documents/1/content")
        .header(TOKEN_HEADER, "test-token")
        .contentType(MediaType.APPLICATION_JSON)
        .content(body))
      .andExpect(status().isNoContent());

    verify(documentService).saveContent(eq(1L), eq(bytes), eq("본문"), eq(3L));
  }

  @Test
  void putContent_invalidBase64_returns400() throws Exception {
    mockMvc.perform(put("/internal/documents/1/content")
        .header(TOKEN_HEADER, "test-token")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"state\":\"!!not-base64!!\",\"plainText\":\"본문\"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void putContent_missingState_returns400() throws Exception {
    mockMvc.perform(put("/internal/documents/1/content")
        .header(TOKEN_HEADER, "test-token")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"plainText\":\"본문\"}"))
      .andExpect(status().isBadRequest());
  }
}
