package dev.jkchappy.portal.favorite;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentFavoriteRepository extends JpaRepository<DocumentFavorite, DocumentFavoriteKey> {

  // 본인 즐겨찾기를 목록 순서대로 (같은 순서면 먼저 넣은 것부터)
  List<DocumentFavorite> findByMemberIdOrderBySortOrderAscCreatedAtAsc(Long memberId);
}
