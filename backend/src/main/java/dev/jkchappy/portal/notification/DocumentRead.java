package dev.jkchappy.portal.notification;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 팀원이 페이지를 마지막으로 확인한 시각
@Entity
@Table(name = "document_read")
@IdClass(DocumentReadKey.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentRead {

  @Id
  @Column(name = "member_id")
  private Long memberId;

  @Id
  @Column(name = "document_id")
  private Long documentId;

  @Column(name = "read_at", nullable = false)
  private Instant readAt;
}
