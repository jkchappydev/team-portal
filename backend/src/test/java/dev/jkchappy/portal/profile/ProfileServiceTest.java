package dev.jkchappy.portal.profile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.profile.dto.ProfileResponse;
import java.io.InputStream;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class ProfileServiceTest {

  private static final String OLD = "11111111-1111-1111-1111-111111111111";
  private static final String NEW = "22222222-2222-2222-2222-222222222222";

  @Mock
  private MemberRepository memberRepository;

  @Mock
  private FileStorage fileStorage;

  private ProfileService service;
  private Member member;

  @BeforeEach
  void setUp() {
    service = new ProfileService(memberRepository, fileStorage);
    member = Member.create("홍길동");
    ReflectionTestUtils.setField(member, "id", 3L);
  }

  @Test
  void changeColor_savesLowercaseAndNullResetsToAuto() {
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));

    assertThat(service.changeColor(3L, "#F08C00").profileColor()).isEqualTo("#f08c00");
    assertThat(service.changeColor(3L, null).profileColor()).isNull();
  }

  @Test
  void changeColor_rejectsInvalidFormat() {
    assertThatThrownBy(() -> service.changeColor(3L, "red"))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void changeImage_replacesAndDeletesPreviousFile() {
    member.replaceProfileImage(OLD, "image/png");
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));
    when(fileStorage.save(any(InputStream.class))).thenReturn(NEW);

    ProfileResponse response = service.changeImage(3L,
      new MockMultipartFile("file", "me.jpg", "image/jpeg", new byte[] {1, 2, 3}));

    assertThat(response.profileImageUrl()).isEqualTo("/api/members/3/profile-image?v=22222222");
    assertThat(member.getProfileImageType()).isEqualTo("image/jpeg");
    // 트랜잭션 밖이라 바로 이전 파일 삭제
    verify(fileStorage).delete(OLD);
  }

  @Test
  void changeImage_rejectsNonImageAndSvg() {
    assertThatThrownBy(() -> service.changeImage(3L,
      new MockMultipartFile("file", "a.svg", "image/svg+xml", new byte[] {1})))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
    verify(fileStorage, never()).save(any());
  }

  @Test
  void changeImage_rejectsTooLarge() {
    byte[] big = new byte[(int) ProfileService.MAX_IMAGE_BYTES + 1];
    assertThatThrownBy(() -> service.changeImage(3L, new MockMultipartFile("file", "a.png", "image/png", big)))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.FILE_TOO_LARGE));
  }

  @Test
  void removeImage_clearsAndDeletesFile() {
    member.replaceProfileImage(OLD, "image/png");
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));

    assertThat(service.removeImage(3L).profileImageUrl()).isNull();
    assertThat(member.getProfileImageType()).isNull();
    verify(fileStorage).delete(OLD);
  }

  @Test
  void loadImage_withoutImage_throwsNotFound() {
    when(memberRepository.findById(3L)).thenReturn(Optional.of(member));

    assertThatThrownBy(() -> service.loadImage(3L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
  }
}
