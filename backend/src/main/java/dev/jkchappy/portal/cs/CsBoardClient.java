package dev.jkchappy.portal.cs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// CS 시스템(cs-board)의 외부 연동 API 호출
@Component
public class CsBoardClient {

  static final String API_KEY_HEADER = "X-Api-Key";
  private static final JsonMapper JSON = JsonMapper.builder().build();

  private final String apiUrl;
  private final String apiKey;
  private final HttpClient httpClient;

  public CsBoardClient(
    @Value("${app.cs.api-url:}") String apiUrl,
    @Value("${app.cs.api-key:}") String apiKey) {
    this.apiUrl = trimTrailingSlash(apiUrl.trim());
    this.apiKey = apiKey.trim();
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
  }

  public boolean isEnabled() {
    return !apiUrl.isBlank() && !apiKey.isBlank();
  }

  public String apiUrl() {
    return apiUrl;
  }

  // 전체 상태 CS를 등록일 최신순으로 size건 조회
  public List<CsBoardItem> fetchNew(int size) {
    if (!isEnabled()) return List.of();
    HttpRequest request = HttpRequest.newBuilder(URI.create(apiUrl + "/api/external/cs/new?size=" + size))
      .timeout(Duration.ofSeconds(5))
      .header(API_KEY_HEADER, apiKey)
      .header("Accept", "application/json")
      .GET()
      .build();
    try {
      HttpResponse<String> response = httpClient.send(request,
        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalStateException("CS API HTTP " + response.statusCode());
      }
      return parse(response.body());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("CS API 호출이 중단되었습니다.", e);
    } catch (IllegalStateException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalStateException("CS API 호출에 실패했습니다.", e);
    }
  }

  // CS 시스템 공통 응답({httpStatus, message, data}) 중 data 목록만 사용
  static List<CsBoardItem> parse(String json) {
    Envelope envelope = JSON.readValue(json, Envelope.class);
    if (envelope == null || envelope.data() == null) {
      throw new IllegalStateException("CS API 응답에 data가 없습니다.");
    }
    return envelope.data();
  }

  private static String trimTrailingSlash(String url) {
    return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
  }

  @JsonIgnoreProperties(ignoreUnknown = true)
  record Envelope(List<CsBoardItem> data) {
  }
}
