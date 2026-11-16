package dev.jkchappy.portal.contact;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(ExternalContactController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class ExternalContactControllerTest {

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private ExternalContactService contactService;

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
    mockMvc.perform(get("/api/contacts")).andExpect(status().isUnauthorized());
  }

  // 이름은 필수
  @Test
  void create_blankName_returns400() throws Exception {
    mockMvc.perform(post("/api/contacts")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\" \",\"company\":\"가나출판\"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  // 이메일 형식이 아니면 거부
  @Test
  void create_invalidEmail_returns400() throws Exception {
    mockMvc.perform(post("/api/contacts")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"홍길동\",\"email\":\"메일 아님\"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void move_negativeIndex_returns400() throws Exception {
    mockMvc.perform(patch("/api/contacts/1/position")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"index\":-1}"))
      .andExpect(status().isBadRequest());
  }
}
