package dev.jkchappy.portal.space;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.DocumentRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SpaceServiceTest {

  @Mock
  private SpaceRepository spaceRepository;

  @Mock
  private DocumentRepository documentRepository;

  private SpaceService service() {
    return new SpaceService(spaceRepository, documentRepository);
  }

  @Test
  void delete_thenListExcludesSpace() {
    Space space = Space.create("개발", null, 1L);
    ReflectionTestUtils.setField(space, "id", 1L);
    when(spaceRepository.findById(1L)).thenReturn(Optional.of(space));
    when(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc()).thenAnswer(
      inv -> space.isDeleted() ? List.of() : List.of(space));

    service().delete(1L);

    assertThat(space.isDeleted()).isTrue();
    assertThat(service().findAll()).isEmpty();
  }

  @Test
  void restore_unknownId_throwsNotFound() {
    when(spaceRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().restore(99L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  // 프로젝트를 만들면 같은 이름의 본문 페이지가 함께 생성되고 홈으로 연결됨
  @Test
  void create_alsoCreatesHomeDocument() {
    when(spaceRepository.save(org.mockito.ArgumentMatchers.any(Space.class))).thenAnswer(inv -> {
      Space saved = inv.getArgument(0);
      ReflectionTestUtils.setField(saved, "id", 5L);
      return saved;
    });
    when(documentRepository.save(org.mockito.ArgumentMatchers.any(dev.jkchappy.portal.document.Document.class)))
      .thenAnswer(inv -> {
        dev.jkchappy.portal.document.Document doc = inv.getArgument(0);
        ReflectionTestUtils.setField(doc, "id", 50L);
        return doc;
      });

    var result = service().create(new dev.jkchappy.portal.space.dto.SpaceCreateRequest("스쿨북스", null), 1L);

    assertThat(result.homeDocumentId()).isEqualTo(50L);
    org.mockito.Mockito.verify(documentRepository).save(org.mockito.ArgumentMatchers.argThat(
      d -> d.getSpaceId().equals(5L) && d.getTitle().equals("스쿨북스")));
  }

  // 이름 없이 만들면 하위 페이지처럼 "제목 없음"으로 만듦
  @Test
  void create_withoutName_usesDefaultTitle() {
    when(spaceRepository.save(org.mockito.ArgumentMatchers.any(Space.class))).thenAnswer(inv -> {
      Space saved = inv.getArgument(0);
      ReflectionTestUtils.setField(saved, "id", 5L);
      return saved;
    });
    when(documentRepository.save(org.mockito.ArgumentMatchers.any(dev.jkchappy.portal.document.Document.class)))
      .thenAnswer(inv -> inv.getArgument(0));

    var result = service().create(new dev.jkchappy.portal.space.dto.SpaceCreateRequest("  ", null), 1L);

    assertThat(result.name()).isEqualTo("제목 없음");
    org.mockito.Mockito.verify(documentRepository).save(org.mockito.ArgumentMatchers.argThat(
      d -> d.getTitle().equals("제목 없음")));
  }

  // 프로젝트 이름을 바꾸면 본문 페이지 제목도 같이 바뀜
  @Test
  void update_renamesHomeDocument() {
    Space space = Space.create("이전", null, 1L);
    ReflectionTestUtils.setField(space, "id", 5L);
    space.assignHomeDocument(50L);
    dev.jkchappy.portal.document.Document home = dev.jkchappy.portal.document.Document.create(5L, "이전", 1L);
    ReflectionTestUtils.setField(home, "id", 50L);
    when(spaceRepository.findById(5L)).thenReturn(Optional.of(space));
    when(documentRepository.findById(50L)).thenReturn(Optional.of(home));

    service().update(5L, new dev.jkchappy.portal.space.dto.SpaceRequest("새 이름", null));

    assertThat(space.getName()).isEqualTo("새 이름");
    assertThat(home.getTitle()).isEqualTo("새 이름");
  }

  // 프로젝트 목록의 아이콘은 본문 페이지 아이콘
  @Test
  void findAll_usesHomeDocumentIcon() {
    Space withIcon = Space.create("스쿨북스", null, 1L);
    ReflectionTestUtils.setField(withIcon, "id", 1L);
    withIcon.assignHomeDocument(10L);
    Space withoutIcon = Space.create("개발", null, 1L);
    ReflectionTestUtils.setField(withoutIcon, "id", 2L);
    withoutIcon.assignHomeDocument(20L);
    dev.jkchappy.portal.document.Document home = dev.jkchappy.portal.document.Document.create(1L, "스쿨북스", 1L);
    ReflectionTestUtils.setField(home, "id", 10L);
    home.changeIcon("🎯", 1L);
    dev.jkchappy.portal.document.Document plain = dev.jkchappy.portal.document.Document.create(2L, "개발", 1L);
    ReflectionTestUtils.setField(plain, "id", 20L);
    when(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc()).thenReturn(List.of(withIcon, withoutIcon));
    when(documentRepository.countLiveBySpaceIds(List.of(1L, 2L))).thenReturn(List.of());
    when(documentRepository.findAllById(List.of(10L, 20L))).thenReturn(List.of(home, plain));

    var result = service().findAll();

    assertThat(result).extracting(dev.jkchappy.portal.space.dto.SpaceResponse::icon).containsExactly("🎯", null);
  }

  private Space space(Long id, String name, int sortOrder) {
    Space space = Space.create(name, null, 1L);
    ReflectionTestUtils.setField(space, "id", id);
    space.changeSortOrder(sortOrder);
    return space;
  }

  // 맨 위 최상위 페이지를 맨 아래로 끌어 내리면 나머지가 한 칸씩 올라감
  @Test
  void move_toBottom_reordersAll() {
    Space a = space(1L, "양식", 0);
    Space b = space(2L, "스쿨북스", 1);
    Space c = space(3L, "인생서가", 2);
    when(spaceRepository.findById(1L)).thenReturn(Optional.of(a));
    when(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc()).thenReturn(List.of(a, b, c));

    service().move(1L, 2);

    assertThat(List.of(b, c, a)).extracting(Space::getSortOrder).containsExactly(0, 1, 2);
  }

  @Test
  void move_indexOutOfRange_placesLast() {
    Space a = space(1L, "양식", 0);
    Space b = space(2L, "스쿨북스", 1);
    when(spaceRepository.findById(2L)).thenReturn(Optional.of(b));
    when(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc()).thenReturn(List.of(a, b));

    service().move(2L, 0);

    assertThat(b.getSortOrder()).isEqualTo(0);
    assertThat(a.getSortOrder()).isEqualTo(1);
  }

  @Test
  void move_deletedSpace_throwsNotFound() {
    Space a = space(1L, "양식", 0);
    a.softDelete();
    when(spaceRepository.findById(1L)).thenReturn(Optional.of(a));

    assertThatThrownBy(() -> service().move(1L, 0))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }

  // 새 최상위 페이지는 사이드바 맨 아래 순서
  @Test
  void create_appendsAfterLastSpace() {
    when(spaceRepository.findByDeletedAtIsNullOrderBySortOrderAscNameAscIdAsc())
      .thenReturn(List.of(space(1L, "양식", 0), space(2L, "스쿨북스", 4)));
    when(spaceRepository.save(org.mockito.ArgumentMatchers.any(Space.class))).thenAnswer(inv -> {
      Space saved = inv.getArgument(0);
      ReflectionTestUtils.setField(saved, "id", 9L);
      return saved;
    });
    when(documentRepository.save(org.mockito.ArgumentMatchers.any(dev.jkchappy.portal.document.Document.class)))
      .thenAnswer(inv -> inv.getArgument(0));
    org.mockito.ArgumentCaptor<Space> saved = org.mockito.ArgumentCaptor.forClass(Space.class);

    service().create(new dev.jkchappy.portal.space.dto.SpaceCreateRequest("새 페이지", null), 1L);

    org.mockito.Mockito.verify(spaceRepository).save(saved.capture());
    assertThat(saved.getValue().getSortOrder()).isEqualTo(5);
  }
}
