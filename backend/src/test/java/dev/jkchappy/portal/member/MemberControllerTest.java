package dev.jkchappy.portal.member;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
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
import dev.jkchappy.portal.member.dto.MemberResponse;
import dev.jkchappy.portal.member.dto.MemberUpdateRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MemberController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class MemberControllerTest {
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
  private MemberService memberService;

  @Test
  void create_blankName_returns400() throws Exception {
    mockMvc.perform(post("/api/members").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"  \"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void list_returnsApiResponse() throws Exception {
    when(memberService.findAll(false)).thenReturn(List.of(new MemberResponse(1L, "김철수", true, false, null)));

    mockMvc.perform(get("/api/members").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true))
      .andExpect(jsonPath("$.data[0].name").value("김철수"));
  }

  @Test
  void reorderRequiresAdmin() throws Exception {
    doThrow(new BusinessException(ErrorCode.ADMIN_REQUIRED)).when(accountService).requireAdmin(1L);
    mockMvc.perform(patch("/api/members/2/position").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"beforeId\":3}"))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.error.code").value("ADMIN_REQUIRED"));
  }

  @Test
  void adminCanReorder() throws Exception {
    mockMvc.perform(patch("/api/members/2/position").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"beforeId\":3}"))
      .andExpect(status().isNoContent());
    verify(memberService).move(2L, 3L);
  }

  @Test
  void adminCanUpdateDepartmentAndRank() throws Exception {
    when(memberService.update(2L, new MemberUpdateRequest(null, null, "개발팀", JobRank.SENIOR)))
      .thenReturn(new MemberResponse(2L, "팀원", true, false, null, "개발팀", JobRank.SENIOR));
    mockMvc.perform(patch("/api/members/2").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"department\":\"개발팀\",\"jobRank\":\"SENIOR\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.department").value("개발팀"))
      .andExpect(jsonPath("$.data.jobRank").value("SENIOR"));
  }

  @Test
  void adminCanDeleteMember() throws Exception {
    mockMvc.perform(delete("/api/members/2").with(loginAs(1L)))
      .andExpect(status().isNoContent());
    verify(memberService).delete(2L, 1L);
  }

  @Test
  void deleteRequiresAdmin() throws Exception {
    doThrow(new BusinessException(ErrorCode.ADMIN_REQUIRED)).when(accountService).requireAdmin(1L);
    mockMvc.perform(delete("/api/members/2").with(loginAs(1L)))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.error.code").value("ADMIN_REQUIRED"));
  }

  @Test
  void memberCanUpdateOwnInfo() throws Exception {
    doThrow(new BusinessException(ErrorCode.ADMIN_REQUIRED)).when(accountService).requireAdmin(1L);
    when(memberService.update(1L, new MemberUpdateRequest("한도윤", null, "개발팀", JobRank.SENIOR)))
      .thenReturn(new MemberResponse(1L, "한도윤", true, false, null, "개발팀", JobRank.SENIOR));
    mockMvc.perform(patch("/api/members/1").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"한도윤\",\"department\":\"개발팀\",\"jobRank\":\"SENIOR\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.department").value("개발팀"));
  }

  @Test
  void memberCannotChangeOwnActiveState() throws Exception {
    doThrow(new BusinessException(ErrorCode.ADMIN_REQUIRED)).when(accountService).requireAdmin(1L);
    mockMvc.perform(patch("/api/members/1").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.error.code").value("ADMIN_REQUIRED"));
  }

  @Test
  void memberCannotUpdateOthers() throws Exception {
    doThrow(new BusinessException(ErrorCode.ADMIN_REQUIRED)).when(accountService).requireAdmin(1L);
    mockMvc.perform(patch("/api/members/2").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"department\":\"개발팀\"}"))
      .andExpect(status().isForbidden())
      .andExpect(jsonPath("$.error.code").value("ADMIN_REQUIRED"));
  }
}
