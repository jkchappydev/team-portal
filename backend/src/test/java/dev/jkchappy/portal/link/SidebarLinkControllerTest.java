package dev.jkchappy.portal.link;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

@WebMvcTest(SidebarLinkController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class SidebarLinkControllerTest {

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private SidebarLinkService linkService;

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
    mockMvc.perform(get("/api/links")).andExpect(status().isUnauthorized());
  }

  @Test
  void create_blankUrl_returns400() throws Exception {
    mockMvc.perform(post("/api/links")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"url\":\"  \"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  // 제목은 필수
  @Test
  void create_blankTitle_returns400() throws Exception {
    mockMvc.perform(post("/api/links")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"url\":\"https://figma.com\",\"title\":\" \"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void update_blankUrl_returns400() throws Exception {
    mockMvc.perform(put("/api/links/1")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"url\":\" \",\"title\":\"사내 위키\"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void move_negativeIndex_returns400() throws Exception {
    mockMvc.perform(patch("/api/links/1/position")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"index\":-1}"))
      .andExpect(status().isBadRequest());
  }
}
