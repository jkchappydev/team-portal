package dev.jkchappy.portal.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;

@TestConfiguration
@EnableWebSecurity
public class ControllerTestSecurity {
  @Bean
  SecurityFilterChain testFilterChain(HttpSecurity http) throws Exception {
    return http.authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
      .csrf(csrf -> csrf.disable()).build();
  }

  public static RequestPostProcessor loginAs(long id) {
    return request -> {
      csrf().postProcessRequest(request);
      return oidcLogin().idToken(token -> token.subject("test-sub-" + id)).postProcessRequest(request);
    };
  }
}
