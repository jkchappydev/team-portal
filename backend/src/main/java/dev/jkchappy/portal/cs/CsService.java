package dev.jkchappy.portal.cs;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.cs.dto.NewCsListResponse;
import dev.jkchappy.portal.cs.dto.NewCsResponse;
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
  private static final ZoneId CS_ZONE = ZoneId.of("Asia/Seoul");
  private static final DateTimeFormatter CS_DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

  private final CsBoardClient csBoardClient;
  private final String webUrl;

  public CsService(CsBoardClient csBoardClient, @Value("${app.cs.web-url:}") String webUrl) {
    this.csBoardClient = csBoardClient;
    String trimmed = webUrl.trim();
    this.webUrl = trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
  }

  // CS 시스템의 요청 상태 CS 최신 10건 (연동 미설정이면 빈 목록)
  public NewCsListResponse findNew() {
    if (!csBoardClient.isEnabled()) {
      return new NewCsListResponse(false, List.of());
    }
    List<CsBoardItem> items;
    try {
      items = csBoardClient.fetchNew(NEW_CS_LIMIT);
    } catch (RuntimeException e) {
      log.warn("신규 CS 목록 조회 실패: {}", e.getMessage());
      throw new BusinessException(ErrorCode.CS_UNAVAILABLE);
    }
    return new NewCsListResponse(true, items.stream().map(this::toResponse).toList());
  }

  private NewCsResponse toResponse(CsBoardItem item) {
    return new NewCsResponse(item.boardKey(), item.boardTitle(), item.groupName(), item.csUserName(),
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
