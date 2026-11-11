package dev.jkchappy.portal.favorite;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

// 팀원이 즐겨찾기에 넣은 페이지와 목록 안 순서
@Entity
@Table(name = "document_favorite")
@IdClass(DocumentFavoriteKey.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class DocumentFavorite {

  @Id
  @Column(name = "member_id")
  private Long memberId;

  @Id
  @Column(name = "document_id")
  private Long documentId;

  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  public static DocumentFavorite of(Long memberId, Long documentId, int sortOrder, Instant createdAt) {
    DocumentFavorite favorite = new DocumentFavorite();
    favorite.memberId = memberId;
    favorite.documentId = documentId;
    favorite.sortOrder = sortOrder;
    favorite.createdAt = createdAt;
    return favorite;
  }

  public void changeOrder(int sortOrder) {
    this.sortOrder = sortOrder;
  }
}
