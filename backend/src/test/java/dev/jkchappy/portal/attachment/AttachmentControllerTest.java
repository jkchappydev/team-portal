package dev.jkchappy.portal.attachment;

import static org.assertj.core.api.Assertions.assertThat;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

// 실제 포트로 기동해 Tomcat/멀티파트 한도 동작까지 확인
@Import(TestcontainersConfig.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class AttachmentControllerTest {

  private static final Path STORAGE = createStorageDir();

  private static Path createStorageDir() {
    try {
      return Files.createTempDirectory("attachment-test");
    } catch (IOException e) {
      throw new IllegalStateException(e);
    }
  }

  @DynamicPropertySource
  static void props(DynamicPropertyRegistry registry) {
    registry.add("app.storage.path", STORAGE::toString);
    registry.add("spring.servlet.multipart.max-file-size", () -> "1KB");
    registry.add("spring.servlet.multipart.max-request-size", () -> "1KB");
  }

  @LocalServerPort
  private int port;

  @Autowired
  private MemberRepository memberRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private DocumentRepository documentRepository;

  private Long userId;
  private Long documentId;
  private RestClient client;

  @BeforeEach
  void setUp() {
    Member member = memberRepository.save(Member.create("홍길동"));
    Space space = spaceRepository.save(Space.create("개발", null, member.getId()));
    Document doc = documentRepository.save(Document.create(space.getId(), "문서", member.getId()));
    userId = member.getId();
    documentId = doc.getId();
    client = RestClient.builder().baseUrl("http://localhost:" + port)
      .defaultStatusHandler(HttpStatusCode::isError, (req, res) -> { })
      .build();
  }

  private ResponseEntity<String> upload(String fileName, byte[] bytes) {
    return upload(fileName, bytes, null, false);
  }

  private ResponseEntity<String> upload(String fileName, byte[] bytes, String partContentType,
    boolean inline) {
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
    ByteArrayResource resource = new ByteArrayResource(bytes) {
      @Override
      public String getFilename() {
        return fileName;
      }
    };
    HttpHeaders partHeaders = new HttpHeaders();
    if (partContentType != null) {
      partHeaders.set(HttpHeaders.CONTENT_TYPE, partContentType);
    }
    body.add("file", new HttpEntity<>(resource, partHeaders));
    return client.post().uri("/api/documents/{id}/attachments?inline={inline}", documentId, inline)
      .header("X-User-Id", String.valueOf(userId))
      .contentType(MediaType.MULTIPART_FORM_DATA)
      .body(body)
      .retrieve().toEntity(String.class);
  }

  @Test
  void download_keepsKoreanFileName() {
    ResponseEntity<String> uploaded = upload("기술정리 v2.pdf", "pdf-bytes".getBytes());
    assertThat(uploaded.getStatusCode().value()).isEqualTo(200);
    String body = uploaded.getBody();
    assertThat(body).contains("기술정리 v2.pdf");
    String id = body.replaceAll("(?s).*\"id\":(\\d+).*", "$1");

    ResponseEntity<byte[]> download = client.get().uri("/api/attachments/{id}/download", id)
      .header("X-User-Id", String.valueOf(userId))
      .retrieve().toEntity(byte[].class);

    assertThat(download.getStatusCode().value()).isEqualTo(200);
    assertThat(download.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
      .contains("filename*=UTF-8''%EA%B8%B0");
    assertThat(new String(download.getBody())).isEqualTo("pdf-bytes");
  }

  @Test
  void download_invalidContentType_fallsBackToOctetStream() {
    // RestClient가 잘못된 파트 타입을 거부하므로 멀티파트 본문을 직접 구성
    String raw = "--b\r\nContent-Disposition: form-data; name=\"file\"; filename=\"a.bin\"\r\n"
      + "Content-Type: foo\r\n\r\nx\r\n--b--\r\n";
    ResponseEntity<String> uploaded = client.post()
      .uri("/api/documents/{id}/attachments", documentId)
      .header("X-User-Id", String.valueOf(userId))
      .header(HttpHeaders.CONTENT_TYPE, "multipart/form-data; boundary=b")
      .body(raw)
      .retrieve().toEntity(String.class);
    assertThat(uploaded.getStatusCode().value()).isEqualTo(200);
    assertThat(uploaded.getBody()).contains("\"contentType\":\"application/octet-stream\"");
    String id = uploaded.getBody().replaceAll("(?s).*\"id\":(\\d+).*", "$1");

    ResponseEntity<byte[]> download = client.get().uri("/api/attachments/{id}/download", id)
      .header("X-User-Id", String.valueOf(userId))
      .retrieve().toEntity(byte[].class);

    assertThat(download.getStatusCode().value()).isEqualTo(200);
    assertThat(download.getHeaders().getContentType().toString())
      .isEqualTo("application/octet-stream");
  }

  @Test
  void list_excludesInlineUploads() {
    upload("normal.txt", "a".getBytes(), "text/plain", false);
    upload("inline.png", "b".getBytes(), "image/png", true);

    ResponseEntity<String> list = client.get()
      .uri("/api/documents/{id}/attachments", documentId)
      .header("X-User-Id", String.valueOf(userId))
      .retrieve().toEntity(String.class);

    assertThat(list.getBody()).contains("normal.txt").doesNotContain("inline.png");
  }

  @Test
  void upload_overLimit_returns413() {
    ResponseEntity<String> response = upload("big.bin", new byte[2048]);

    assertThat(response.getStatusCode().value()).isEqualTo(413);
    assertThat(response.getBody()).contains("\"code\":\"FILE_TOO_LARGE\"");
  }
}
