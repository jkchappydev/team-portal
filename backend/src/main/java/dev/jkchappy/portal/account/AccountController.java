package dev.jkchappy.portal.account;

import dev.jkchappy.portal.account.dto.AuthMeResponse;
import dev.jkchappy.portal.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AccountController {
  private final AccountService accounts;

  @GetMapping("/me")
  public ApiResponse<AuthMeResponse> me(@AuthenticationPrincipal OidcUser user) {
    return ApiResponse.ok(accounts.me(user.getSubject()));
  }
}
