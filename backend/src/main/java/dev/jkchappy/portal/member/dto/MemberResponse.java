package dev.jkchappy.portal.member.dto;

import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.JobRank;

public record MemberResponse(Long id, String name, boolean active, boolean admin, String email,
  String department, JobRank jobRank) {

  public MemberResponse(Long id, String name, boolean active, boolean admin, String email) {
    this(id, name, active, admin, email, null, null);
  }

  public static MemberResponse from(Member member) {
    return from(member, null);
  }

  public static MemberResponse from(Member member, String email) {
    return new MemberResponse(member.getId(), member.getName(), member.isActive(), member.isAdmin(), email,
      member.getDepartment(), member.getJobRank());
  }
}
