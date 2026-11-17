package dev.jkchappy.portal.document.dto;

import dev.jkchappy.portal.document.Document;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;

// cover: 프로젝트 본문 커버 (일반 페이지는 null), home: 최상위 페이지 본문 여부, path: 최상위부터 바로 위 페이지까지
// kind: PAGE, FILE 또는 WBS, fileUrl: 파일 항목의 다운로드 주소 (페이지는 null)
public record DocumentDetail(Long id, Long spaceId, String spaceName, String title, String icon, String cover,
  String createdByName, String updatedByName, OffsetDateTime updatedAt, boolean home,
  Long parentId, List<PageRef> path, String kind, String fileUrl) {

  public static DocumentDetail from(Document doc, String spaceName, String createdByName,
    String updatedByName, boolean home, List<PageRef> path) {
    String fileUrl = doc.isFile() && doc.getAttachmentId() != null
      ? "/api/attachments/" + doc.getAttachmentId() + "/download" : null;
    return new DocumentDetail(doc.getId(), doc.getSpaceId(), spaceName, doc.getTitle(),
      doc.getIcon(), doc.getCover(), createdByName, updatedByName, doc.getUpdatedAt().atOffset(ZoneOffset.UTC), home,
      doc.getParentId(), path, doc.getKind().name(), fileUrl);
  }
}
