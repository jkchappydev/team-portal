package dev.jkchappy.portal.profile;

import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.MemberRepository;
import dev.jkchappy.portal.profile.dto.ProfileResponse;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Set;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

// 본인 프로필 색·이미지 관리
@Slf4j
@Service
@RequiredArgsConstructor
public class ProfileService {

  // 동그라미에 작게 보이므로 2MB면 충분
  static final long MAX_IMAGE_BYTES = 2L * 1024 * 1024;
  // 스크립트를 담을 수 있는 SVG는 받지 않음
  private static final Set<String> IMAGE_TYPES = Set.of("image/png", "image/jpeg", "image/gif", "image/webp");
  private static final Pattern COLOR = Pattern.compile("#[0-9a-fA-F]{6}");

  private final MemberRepository memberRepository;
  private final FileStorage fileStorage;

  public record Image(Resource resource, String contentType) {
  }

  @Transactional(readOnly = true)
  public ProfileResponse get(Long memberId) {
    return ProfileResponse.from(getMember(memberId));
  }

  // null이면 자동 색으로 되돌림
  @Transactional
  public ProfileResponse changeColor(Long memberId, String color) {
    if (color != null && !COLOR.matcher(color).matches()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "색은 #rrggbb 형식이어야 합니다.");
    }
    Member member = getMember(memberId);
    member.changeProfileColor(color == null ? null : color.toLowerCase());
    return ProfileResponse.from(member);
  }

  // 새 이미지를 저장하고, 커밋되면 이전 이미지 파일 삭제 (롤백되면 새 파일 삭제)
  @Transactional
  public ProfileResponse changeImage(Long memberId, MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "비어 있는 파일은 올릴 수 없습니다.");
    }
    String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
    if (!IMAGE_TYPES.contains(contentType)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "PNG, JPG, GIF, WEBP 이미지만 올릴 수 있습니다.");
    }
    if (file.getSize() > MAX_IMAGE_BYTES) {
      throw new BusinessException(ErrorCode.FILE_TOO_LARGE, "프로필 이미지는 2MB까지 올릴 수 있습니다.");
    }
    Member member = getMember(memberId);
    String storedName;
    try (InputStream in = file.getInputStream()) {
      storedName = fileStorage.save(in);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
    String previous = member.replaceProfileImage(storedName, contentType);
    afterCompletion(previous, storedName);
    return ProfileResponse.from(member);
  }

  // 이미지를 지우면 이름 두 글자 동그라미로 돌아감
  @Transactional
  public ProfileResponse removeImage(Long memberId) {
    Member member = getMember(memberId);
    String previous = member.replaceProfileImage(null, null);
    afterCompletion(previous, null);
    return ProfileResponse.from(member);
  }

  @Transactional(readOnly = true)
  public Image loadImage(Long memberId) {
    Member member = memberRepository.findById(memberId)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    if (member.getProfileImage() == null) {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }
    return new Image(fileStorage.load(member.getProfileImage()), member.getProfileImageType());
  }

  private Member getMember(Long memberId) {
    return memberRepository.findById(memberId)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
  }

  // 커밋되면 버린 파일, 롤백되면 새로 저장한 파일을 지움 (파일 삭제 실패는 기록만)
  private void afterCompletion(String committedGarbage, String rollbackGarbage) {
    if (!TransactionSynchronizationManager.isSynchronizationActive()) {
      deleteQuietly(committedGarbage);
      return;
    }
    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
      @Override
      public void afterCompletion(int status) {
        deleteQuietly(status == STATUS_COMMITTED ? committedGarbage : rollbackGarbage);
      }
    });
  }

  private void deleteQuietly(String storedName) {
    if (storedName == null) {
      return;
    }
    try {
      fileStorage.delete(storedName);
    } catch (RuntimeException e) {
      log.warn("프로필 이미지 파일 삭제 실패: {}", storedName, e);
    }
  }
}
