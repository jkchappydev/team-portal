package dev.jkchappy.portal.favorite;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

// document_favorite 복합 키 (팀원 ID + 페이지 ID)
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class DocumentFavoriteKey implements Serializable {

  private Long memberId;
  private Long documentId;
}
