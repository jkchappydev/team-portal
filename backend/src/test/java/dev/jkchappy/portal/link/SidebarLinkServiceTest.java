package dev.jkchappy.portal.link;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.link.dto.LinkCreateRequest;
import dev.jkchappy.portal.link.dto.LinkResponse;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class SidebarLinkServiceTest {

  @Mock
  private SidebarLinkRepository linkRepository;

  private SidebarLinkService service() {
    return new SidebarLinkService(linkRepository);
  }

  private SidebarLink link(long id, int sortOrder) {
    SidebarLink link = SidebarLink.create("링크" + id, "https://example.com/" + id, null, sortOrder, 1L);
    ReflectionTestUtils.setField(link, "id", id);
    return link;
  }

  // 제목 앞뒤 공백을 지우고 목록 맨 아래에 놓임
  @Test
  void create_trimsTitleAndGoesLast() {
    when(linkRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of(link(1L, 0), link(2L, 4)));
    when(linkRepository.save(any(SidebarLink.class))).thenAnswer(inv -> inv.getArgument(0));

    LinkResponse created = service().create(new LinkCreateRequest("https://www.figma.com/files/team", " 디자인 시안 "), 3L);

    assertThat(created.title()).isEqualTo("디자인 시안");
    assertThat(created.url()).isEqualTo("https://www.figma.com/files/team");
    verify(linkRepository).save(org.mockito.ArgumentMatchers.argThat(l -> l.getSortOrder() == 5));
  }

  // 주소 앞 https://가 빠져 있으면 붙여서 저장
  @Test
  void create_withoutScheme_addsHttps() {
    when(linkRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of());
    when(linkRepository.save(any(SidebarLink.class))).thenAnswer(inv -> inv.getArgument(0));

    LinkResponse created = service().create(new LinkCreateRequest("  jenkins.example.com/job ", "젠킨스"), 3L);

    assertThat(created.url()).isEqualTo("https://jenkins.example.com/job");
    assertThat(created.title()).isEqualTo("젠킨스");
  }

  // 아이콘은 선택값, 이모지는 그대로 저장하고 비어 있으면 없음
  @Test
  void create_withIcon_keepsEmoji() {
    when(linkRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of());
    when(linkRepository.save(any(SidebarLink.class))).thenAnswer(inv -> inv.getArgument(0));

    assertThat(service().create(new LinkCreateRequest("https://figma.com", "피그마", " 🎨 "), 1L).icon()).isEqualTo("🎨");
    assertThat(service().create(new LinkCreateRequest("https://figma.com", "피그마", " "), 1L).icon()).isNull();
    assertThat(service().create(new LinkCreateRequest("https://figma.com", "피그마"), 1L).icon()).isNull();
  }

  // 이미지 주소나 업로드 이미지 형식은 링크 아이콘으로 거부
  @Test
  void create_nonEmojiIcon_throwsInvalidInput() {
    for (String icon : List.of("https://example.com/a.png", "att:12", "a/b")) {
      assertThatThrownBy(() -> service().create(new LinkCreateRequest("https://figma.com", "피그마", icon), 1L))
        .as(icon)
        .isInstanceOfSatisfying(BusinessException.class,
          e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }
  }

  // 웹 주소가 아니면(javascript:, 빈 호스트 등) 거부
  @Test
  void create_notWebAddress_throwsInvalidInput() {
    for (String url : List.of("javascript:alert(1)", "ftp://files.example.com", "https://", "a b c")) {
      assertThatThrownBy(() -> service().create(new LinkCreateRequest(url, "링크"), 1L))
        .as(url)
        .isInstanceOfSatisfying(BusinessException.class,
          e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    }
  }

  @Test
  void rename_changesTitle() {
    SidebarLink target = link(1L, 0);
    when(linkRepository.findById(1L)).thenReturn(Optional.of(target));

    assertThat(service().rename(1L, "  사내 위키 ").title()).isEqualTo("사내 위키");
  }

  @Test
  void move_reordersFromZero() {
    SidebarLink a = link(1L, 0);
    SidebarLink b = link(2L, 1);
    SidebarLink c = link(3L, 2);
    when(linkRepository.findById(3L)).thenReturn(Optional.of(c));
    when(linkRepository.findAllByOrderBySortOrderAscIdAsc()).thenReturn(List.of(a, b, c));

    service().move(3L, 0);

    assertThat(List.of(c.getSortOrder(), a.getSortOrder(), b.getSortOrder())).containsExactly(0, 1, 2);
  }

  @Test
  void delete_unknownId_throwsNotFound() {
    when(linkRepository.findById(99L)).thenReturn(Optional.empty());

    assertThatThrownBy(() -> service().delete(99L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }
}
