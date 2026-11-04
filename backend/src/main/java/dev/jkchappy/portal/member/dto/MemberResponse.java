package dev.jkchappy.portal.member.dto;

import dev.jkchappy.portal.member.Member;

public record MemberResponse(Long id, String name, boolean active) {

  public static MemberResponse from(Member member) {
    return new MemberResponse(member.getId(), member.getName(), member.isActive());
  }
}
