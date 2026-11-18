package dev.jkchappy.portal.cs;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.cs.dto.NewCsListResponse;
import dev.jkchappy.portal.cs.dto.NewCsResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class CsService {

  static final int NEW_CS_LIMIT = 10;
  // 접속자마다 30초 주기로 다시 조회하므로 CS 시스템 호출은 이 간격에 한 번으로 묶음
  static final Duration NEW_CS_CACHE_TTL = Duration.ofSeconds(20);
  private static final ZoneId CS_ZONE = ZoneId.of("Asia/Seoul");
  private static final DateTimeFormatter CS_DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private final CsBoardClient csBoardClient;
  private final String webUrl;
  private final Clock clock;
  private NewCsListResponse cached;
  private Instant cachedAt;

  public CsService(CsBoardClient csBoardClient, @Value("${app.cs.web-url:}") String webUrl, Clock clock) {
    this.csBoardClient = csBoardClient;
    this.clock = clock;
    String trimmed = webUrl.trim();
    this.webUrl = trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
  }

  // CS 시스템의 최근 등록 CS 10건, 전체 상태 (연동 미설정이면 빈 목록, 성공한 결과는 잠시 재사용)
  public synchronized NewCsListResponse findNew() {
    if (!csBoardClient.isEnabled()) {
      return new NewCsListResponse(false, List.of());
    }
    Instant now = clock.instant();
    if (cached != null && now.isBefore(cachedAt.plus(NEW_CS_CACHE_TTL))) {
      return cached;
    }
    List<CsBoardItem> items;
    try {
      items = csBoardClient.fetchNew(NEW_CS_LIMIT);
    } catch (RuntimeException e) {
      log.warn("신규 CS 목록 조회 실패: {}", e.getMessage());
      throw new BusinessException(ErrorCode.CS_UNAVAILABLE);
    }
    cached = new NewCsListResponse(true, items.stream().map(this::toResponse).toList());
    cachedAt = now;
    return cached;
  }

  private NewCsResponse toResponse(CsBoardItem item) {
    return new NewCsResponse(item.boardKey(), item.boardTitle(), item.groupName(), item.csUserName(),
      item.managerName(), item.csStatus(), item.csStatusName(),
      parseCreatedAt(item.createDate()), detailUrl(item.boardKey()));
  }

  // 상세 화면은 브라우저가 여는 주소라 web-url 우선, 없으면 api-url 사용
  private String detailUrl(Long boardKey) {
    String base = webUrl.isBlank() ? csBoardClient.apiUrl() : webUrl;
    return base + "/detail?boardKey=" + boardKey;
  }

  private static OffsetDateTime parseCreatedAt(String value) {
    if (value == null || value.isBlank()) return null;
    try {
      return LocalDateTime.parse(value.trim(), CS_DATE_TIME).atZone(CS_ZONE).toOffsetDateTime();
    } catch (DateTimeParseException e) {
      return null;
    }
  }
}
