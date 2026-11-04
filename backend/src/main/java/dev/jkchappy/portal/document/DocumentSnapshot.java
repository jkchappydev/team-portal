package dev.jkchappy.portal.document;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 문서 본문 시점 백업
@Entity
@Table(name = "document_snapshot")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentSnapshot {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(name = "document_id", nullable = false, updatable = false)
  private Long documentId;

  @Column(name = "content_state", nullable = false, updatable = false)
  private byte[] contentState;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public static DocumentSnapshot create(Long documentId, byte[] contentState, Instant createdAt) {
    DocumentSnapshot snapshot = new DocumentSnapshot();
    snapshot.documentId = documentId;
    snapshot.contentState = contentState;
    snapshot.createdAt = createdAt;
    return snapshot;
  }
}
