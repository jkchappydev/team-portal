package dev.jkchappy.portal.account;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AdminController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class,
  CurrentUserArgumentResolver.class, InternalTokenInterceptor.class})
class AdminControllerTest {
  @Autowired MockMvc mvc;
  @MockitoBean AccountService accounts;

  @BeforeEach
  void setup() { lenient().when(accounts.requireActiveMemberId("test-sub-1")).thenReturn(1L); }

  @Test
  void nonAdminCannotListRequests() throws Exception {
    doThrow(new BusinessException(ErrorCode.ADMIN_REQUIRED)).when(accounts).requireAdmin(1L);
    mvc.perform(get("/api/admin/signup-requests").with(loginAs(1)))
      .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("ADMIN_REQUIRED"));
  }

  @Test
  void approvalRequiresExactlyOneChoice() throws Exception {
    mvc.perform(post("/api/admin/signup-requests/5/approve").with(loginAs(1))
      .contentType(MediaType.APPLICATION_JSON).content("{\"memberId\":2,\"newMemberName\":\"이름\"}"))
      .andExpect(status().isBadRequest());
    mvc.perform(post("/api/admin/signup-requests/5/approve").with(loginAs(1))
      .contentType(MediaType.APPLICATION_JSON).content("{}"))
      .andExpect(status().isBadRequest());
    verify(accounts, never()).approveWithMember(anyLong(), anyLong(), anyLong());
  }

  @Test
  void approvalPassesMemberAndAdmin() throws Exception {
    mvc.perform(post("/api/admin/signup-requests/5/approve").with(loginAs(1))
      .contentType(MediaType.APPLICATION_JSON).content("{\"memberId\":2,\"department\":\"개발\",\"jobRank\":\"SENIOR\"}"))
      .andExpect(status().isNoContent());
    verify(accounts).approveWithMember(5L, 2L, 1L, "개발", dev.jkchappy.portal.member.JobRank.SENIOR);
  }

  // 관리자는 승인만 하고 부서·직책은 승인된 본인이 입력
  @Test
  void approvalWithoutOrganizationIsAccepted() throws Exception {
    mvc.perform(post("/api/admin/signup-requests/5/approve").with(loginAs(1))
      .contentType(MediaType.APPLICATION_JSON).content("{\"newMemberName\":\"홍길동\"}"))
      .andExpect(status().isNoContent());
    verify(accounts).approveAsNewMember(5L, "홍길동", 1L, null, null);
  }

  // 관리자여도 개발자가 아니면 개발자 권한을 바꿀 수 없음
  @Test
  void nonDeveloperCannotChangeDeveloperRole() throws Exception {
    doThrow(new BusinessException(ErrorCode.FORBIDDEN, "개발자만 개발자 권한을 바꿀 수 있습니다."))
      .when(accounts).requireDeveloper(1L);
    mvc.perform(patch("/api/admin/members/2/developer").with(loginAs(1))
      .contentType(MediaType.APPLICATION_JSON).content("{\"developer\":true}"))
      .andExpect(status().isForbidden());
    verify(accounts, never()).setDeveloper(anyLong(), anyBoolean());
  }

  @Test
  void developerCanChangeDeveloperRole() throws Exception {
    mvc.perform(patch("/api/admin/members/2/developer").with(loginAs(1))
      .contentType(MediaType.APPLICATION_JSON).content("{\"developer\":true}"))
      .andExpect(status().isOk());
    verify(accounts).setDeveloper(2L, true);
  }
}
