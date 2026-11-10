package dev.jkchappy.portal.profile;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.account.Account;
import dev.jkchappy.portal.account.AccountRepository;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.oidc.OidcIdToken;
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser;
import org.springframework.session.Session;
import org.springframework.session.SessionRepository;
import org.springframework.session.jdbc.JdbcIndexedSessionRepository;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

// 실제 포트로 기동해 본인 프로필 색·이미지 변경과 이미지 조회 확인
@Import(TestcontainersConfig.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ProfileControllerTest {

  private static final Path STORAGE = createStorageDir();

  private static Path createStorageDir() {
    try {
      return Files.createTempDirectory("profile-test");
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("app.storage.path", STORAGE::toString);
  }

  @LocalServerPort
  private int port;

  @Autowired
  private MemberRepository memberRepository;

  @Autowired
  private AccountRepository accountRepository;

  @Autowired
  private JdbcIndexedSessionRepository sessions;

  private Long memberId;
  private RestClient client;

  @BeforeEach
  void setUp() {
    Member member = memberRepository.save(Member.create("홍길동"));
    memberId = member.getId();
    String subject = "profile-test-" + memberId;
    Account account = Account.createPending(subject, subject + "@example.com", "홍길동", Instant.now());
    account.approve(member, memberId, Instant.now());
    accountRepository.save(account);
    client = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultHeader(HttpHeaders.COOKIE, "SESSION=" + createSession(subject) + "; XSRF-TOKEN=test-csrf")
      .defaultHeader("X-XSRF-TOKEN", "test-csrf")
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { })
      .build();
  }

  @SuppressWarnings({"rawtypes", "unchecked"})
  private String createSession(String subject) {
    var idToken = OidcIdToken.withTokenValue("test-token").subject(subject)
      .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(600)).build();
    var user = new DefaultOidcUser(List.of(new SimpleGrantedAuthority("ROLE_USER")), idToken);
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(new OAuth2AuthenticationToken(user, user.getAuthorities(), "google"));
    Session session = sessions.createSession();
    session.setAttribute("SPRING_SECURITY_CONTEXT", context);
    ((SessionRepository) sessions).save(session);
    return Base64.getEncoder().encodeToString(session.getId().getBytes(StandardCharsets.UTF_8));
  }

  private ResponseEntity<String> uploadImage(String fileName, String contentType, byte[] bytes) {
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    ByteArrayResource resource = new ByteArrayResource(bytes) {
      @Override
      public String getFilename() {
        return fileName;
      }
    };
    HttpHeaders partHeaders = new HttpHeaders();
    partHeaders.set(HttpHeaders.CONTENT_TYPE, contentType);
    body.add("file", new HttpEntity<>(resource, partHeaders));
    return client.post().uri("/api/me/profile/image")
      .contentType(MediaType.MULTIPART_FORM_DATA)
      .body(body)
      .retrieve().toEntity(String.class);
  }

  @Test
  void changeColor_isShownInMe() {
    var changed = client.put().uri("/api/me/profile/color")
      .contentType(MediaType.APPLICATION_JSON).body(Map.of("color", "#1971C2"))
      .retrieve().toEntity(String.class);
    assertThat(changed.getStatusCode().value()).isEqualTo(200);

    String me = client.get().uri("/api/auth/me").retrieve().body(String.class);
    assertThat(me).contains("\"profileColor\":\"#1971c2\"");
  }

  @Test
  void uploadImage_canBeLoadedAndRemoved() {
    ResponseEntity<String> uploaded = uploadImage("me.png", "image/png", "png-bytes".getBytes());
    assertThat(uploaded.getStatusCode().value()).isEqualTo(200);
    String url = uploaded.getBody().replaceAll("(?s).*\"profileImageUrl\":\"([^\"]+)\".*", "$1");
    assertThat(url).startsWith("/api/members/" + memberId + "/profile-image?v=");

    ResponseEntity<byte[]> image = client.get().uri(url).retrieve().toEntity(byte[].class);
    assertThat(image.getStatusCode().value()).isEqualTo(200);
    assertThat(image.getHeaders().getContentType()).isEqualTo(MediaType.IMAGE_PNG);
    assertThat(image.getHeaders().getCacheControl()).contains("max-age=86400");
    assertThat(new String(image.getBody())).isEqualTo("png-bytes");

    var removed = client.delete().uri("/api/me/profile/image").retrieve().toEntity(String.class);
    assertThat(removed.getBody()).contains("\"profileImageUrl\":null");
    var gone = client.get().uri("/api/members/{id}/profile-image", memberId).retrieve().toEntity(String.class);
    assertThat(gone.getStatusCode().value()).isEqualTo(404);
  }

  @Test
  void uploadImage_rejectsSvg() {
    ResponseEntity<String> uploaded = uploadImage("x.svg", "image/svg+xml", "<svg/>".getBytes());
    assertThat(uploaded.getStatusCode().value()).isEqualTo(400);
  }
}
