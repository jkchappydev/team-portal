package dev.jkchappy.portal.member;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;

class CurrentUserArgumentResolverTest {
  private final AccountService accounts = mock(AccountService.class);
  private final CurrentUserArgumentResolver resolver = new CurrentUserArgumentResolver(accounts);

  @AfterEach
  void clear() { SecurityContextHolder.clearContext(); }

  @Test
  void noAuthenticationIsRejected() {
    assertThatThrownBy(() -> resolver.resolveArgument(null, null, null, null))
      .isInstanceOfSatisfying(BusinessException.class, e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.UNAUTHENTICATED));
  }

  @Test
  void subjectIsResolvedToActiveMember() {
    OidcUser user = mock(OidcUser.class);
    when(user.getSubject()).thenReturn("subject");
    when(accounts.requireActiveMemberId("subject")).thenReturn(3L);
    SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(user, null));
    assertThat(resolver.resolveArgument(null, null, null, null)).isEqualTo(3L);
  }
}
