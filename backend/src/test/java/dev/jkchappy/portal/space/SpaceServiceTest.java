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
    when(spaceRepository.findByDeletedAtIsNullOrderByNameAscIdAsc()).thenAnswer(
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
}
