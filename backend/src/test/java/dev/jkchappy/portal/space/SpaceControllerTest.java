package dev.jkchappy.portal.space;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SpaceController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class SpaceControllerTest {
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
  private SpaceService spaceService;

  @MockitoBean
  private MemberService memberService;

  // 사이드바 "+ 새 페이지"는 이름 없이 바로 만들고 화면에서 이름을 입력
  @Test
  void createSpace_withoutName_isAccepted() throws Exception {
    mockMvc.perform(post("/api/spaces")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{}"))
      .andExpect(status().isOk());
  }

  @Test
  void createSpace_tooLongName_returns400() throws Exception {
    mockMvc.perform(post("/api/spaces")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"" + "가".repeat(101) + "\"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  // 사이드바 "+ 새로 만들기"에서 고른 종류(페이지)를 그대로 서비스에 넘김
  @Test
  void createSpace_withPageKind_passesKind() throws Exception {
    mockMvc.perform(post("/api/spaces")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"kind\":\"PAGE\"}"))
      .andExpect(status().isOk());

    org.mockito.Mockito.verify(spaceService).create(
      org.mockito.ArgumentMatchers.argThat(r -> r.kind() == SpaceKind.PAGE), org.mockito.ArgumentMatchers.eq(1L));
  }

  @Test
  void createSpace_unknownKind_returns400() throws Exception {
    mockMvc.perform(post("/api/spaces")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"kind\":\"FOLDER\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void updateSpace_blankName_returns400() throws Exception {
    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch("/api/spaces/5")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"  \"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void createSpace_withoutUser_returns401() throws Exception {
    mockMvc.perform(post("/api/spaces")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"개발\"}"))
      .andExpect(status().isUnauthorized());
  }
}
