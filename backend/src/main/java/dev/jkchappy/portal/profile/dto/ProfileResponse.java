package dev.jkchappy.portal.profile.dto;

import dev.jkchappy.portal.member.Member;

// profileColor: 본인이 고른 색 (null이면 자동 색)
// profileImageUrl: 이미지가 바뀌면 주소도 바뀌어 브라우저 캐시가 새 이미지를 받음 (null이면 이미지 없음)
public record ProfileResponse(String profileColor, String profileImageUrl) {

  public static ProfileResponse from(Member member) {
    return new ProfileResponse(member.getProfileColor(), imageUrl(member));
  }

  public static String imageUrl(Member member) {
    String image = member.getProfileImage();
    return image == null ? null : "/api/members/" + member.getId() + "/profile-image?v=" + image.substring(0, 8);
  }
}
