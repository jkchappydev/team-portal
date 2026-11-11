package dev.jkchappy.portal.favorite;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ClockConfig;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.favorite.dto.FavoriteResponse;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;

// 실제 DB로 즐겨찾기 추가·순서·숨김·영구 삭제 시 정리 확인
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfig.class, ClockConfig.class, FavoriteService.class})
class FavoriteServiceTest {

  @Autowired
  private FavoriteService favoriteService;

  @Autowired
  private DocumentFavoriteRepository favoriteRepository;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private MemberRepository memberRepository;

  private Long me;
  private Long other;
  private Space space;

  @BeforeEach
  void setUp() {
    me = memberRepository.save(Member.create("나")).getId();
    other = memberRepository.save(Member.create("동료")).getId();
    space = spaceRepository.save(Space.create("개발", null, me));
  }

  private Document page(String title) {
    return documentRepository.saveAndFlush(Document.create(space.getId(), title, me));
  }

  private List<String> titles(List<FavoriteResponse> favorites) {
    return favorites.stream().map(FavoriteResponse::title).toList();
  }

  @Test
  void add_appendsToBottom_onlyOnce_andOnlyForMe() {
    Document a = page("회의록");
    Document b = page("일정");

    favoriteService.add(me, b.getId());
    favoriteService.add(me, a.getId());
    List<FavoriteResponse> result = favoriteService.add(me, b.getId());

    assertThat(titles(result)).containsExactly("일정", "회의록");
    assertThat(favoriteService.list(other)).isEmpty();
  }

  @Test
  void add_missingOrTrashedPage_notFound() {
    Document trashed = page("지운 페이지");
    trashed.softDelete();
    documentRepository.saveAndFlush(trashed);

    assertThatThrownBy(() -> favoriteService.add(me, trashed.getId())).isInstanceOf(BusinessException.class);
    assertThatThrownBy(() -> favoriteService.add(me, 999_999L)).isInstanceOf(BusinessException.class);
  }

  @Test
  void list_hidesTrashedPage_andShowsAgainAfterRestore() {
    Document a = page("회의록");
    Document b = page("일정");
    favoriteService.add(me, a.getId());
    favoriteService.add(me, b.getId());

    a.softDelete();
    documentRepository.saveAndFlush(a);
    assertThat(titles(favoriteService.list(me))).containsExactly("일정");

    a.restore();
    documentRepository.saveAndFlush(a);
    assertThat(titles(favoriteService.list(me))).containsExactly("회의록", "일정");
  }

  @Test
  void list_homePage_usesProjectNameAndHomeFlag() {
    Document home = page("본문");
    space.assignHomeDocument(home.getId());
    spaceRepository.saveAndFlush(space);

    List<FavoriteResponse> result = favoriteService.add(me, home.getId());

    assertThat(result).singleElement().satisfies(favorite -> {
      assertThat(favorite.title()).isEqualTo("개발");
      assertThat(favorite.home()).isTrue();
    });
  }

  @Test
  void move_reordersByVisibleIndex() {
    Document a = page("가");
    Document b = page("나");
    Document c = page("다");
    favoriteService.add(me, a.getId());
    favoriteService.add(me, b.getId());
    favoriteService.add(me, c.getId());

    assertThat(titles(favoriteService.move(me, c.getId(), 0))).containsExactly("다", "가", "나");
    assertThat(titles(favoriteService.move(me, c.getId(), 9))).containsExactly("가", "나", "다");
    assertThatThrownBy(() -> favoriteService.move(other, a.getId(), 0)).isInstanceOf(BusinessException.class);
  }

  @Test
  void remove_deletesOnlyMine_andIgnoresMissing() {
    Document a = page("회의록");
    favoriteService.add(me, a.getId());
    favoriteService.add(other, a.getId());

    assertThat(favoriteService.remove(me, a.getId())).isEmpty();
    assertThat(favoriteService.remove(me, a.getId())).isEmpty();
    assertThat(titles(favoriteService.list(other))).containsExactly("회의록");
  }

  @Test
  void permanentDelete_removesFavoritesByCascade() {
    Document a = page("회의록");
    favoriteService.add(me, a.getId());
    favoriteRepository.flush();

    documentRepository.deleteByIds(List.of(a.getId()));

    assertThat(favoriteRepository.findByMemberIdOrderBySortOrderAscCreatedAtAsc(me)).isEmpty();
  }
}
