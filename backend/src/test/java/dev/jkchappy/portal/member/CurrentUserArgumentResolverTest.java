package dev.jkchappy.portal.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

class CurrentUserArgumentResolverTest {

  private MemberService memberService;
  private CurrentUserArgumentResolver resolver;

  @BeforeEach
  void setUp() {
    memberService = mock(MemberService.class);
    resolver = new CurrentUserArgumentResolver(memberService);
  }

  private Object resolve(String header) {
    MockHttpServletRequest request = new MockHttpServletRequest();
    if (header != null) {
      request.addHeader("X-User-Id", header);
    }
    return resolver.resolveArgument(null, null, new ServletWebRequest(request), null);
  }

  private void assertUserNotSelected(String header) {
    assertThatThrownBy(() -> resolve(header))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.USER_NOT_SELECTED));
  }

  @Test
  void resolve_missingHeader_throwsUserNotSelected() {
    assertUserNotSelected(null);
  }

  @Test
  void resolve_nonNumericHeader_throwsUserNotSelected() {
    assertUserNotSelected("abc");
  }

  @Test
  void resolve_inactiveMember_throwsUserNotSelected() {
    when(memberService.getActiveMember(anyLong()))
      .thenThrow(new BusinessException(ErrorCode.USER_NOT_SELECTED));

    assertUserNotSelected("3");
  }

  @Test
  void resolve_activeMember_returnsId() {
    when(memberService.getActiveMember(3L)).thenReturn(Member.create("가"));

    assertThat(resolve("3")).isEqualTo(3L);
  }
}
