package dev.jkchappy.portal.cs;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.cs.dto.NewCsListResponse;
import dev.jkchappy.portal.cs.dto.NewCsResponse;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(CsController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class CsControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private MemberService memberService;

  @MockitoBean
  private CsService csService;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }

  @Test
  void listNew_returnsNewCsList() throws Exception {
    when(csService.findNew()).thenReturn(new NewCsListResponse(true, List.of(
      new NewCsResponse(3L, "로그인 오류", "A기관", "홍길동",
        OffsetDateTime.of(2026, 11, 18, 10, 0, 0, 0, ZoneOffset.ofHours(9)),
        "https://cs.example.com/detail?boardKey=3"))));

    mockMvc.perform(get("/api/cs/new"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true))
      .andExpect(jsonPath("$.data.configured").value(true))
      .andExpect(jsonPath("$.data.items[0].id").value(3))
      .andExpect(jsonPath("$.data.items[0].title").value("로그인 오류"))
      .andExpect(jsonPath("$.data.items[0].groupName").value("A기관"))
      .andExpect(jsonPath("$.data.items[0].requesterName").value("홍길동"))
      .andExpect(jsonPath("$.data.items[0].detailUrl").value("https://cs.example.com/detail?boardKey=3"));
  }

  @Test
  void listNew_returnsBadGatewayWhenCsSystemFails() throws Exception {
    when(csService.findNew()).thenThrow(new BusinessException(ErrorCode.CS_UNAVAILABLE));

    mockMvc.perform(get("/api/cs/new"))
      .andExpect(status().isBadGateway())
      .andExpect(jsonPath("$.success").value(false))
      .andExpect(jsonPath("$.error.code").value("CS_UNAVAILABLE"));
  }
}
