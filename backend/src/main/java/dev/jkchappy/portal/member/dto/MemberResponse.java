package dev.jkchappy.portal.member.dto;

import dev.jkchappy.portal.member.Member;
import dev.jkchappy.portal.member.JobRank;

// developer: 개발자 권한 (DB에서만 지정, 화면에서 권한을 바꿀 수 없음)
public record MemberResponse(Long id, String name, boolean active, boolean admin, String email,
  String department, JobRank jobRank, String phone, String extension, boolean developer) {

  public MemberResponse(Long id, String name, boolean active, boolean admin, String email,
    String department, JobRank jobRank, String phone, String extension) {
    this(id, name, active, admin, email, department, jobRank, phone, extension, false);
  }

  public MemberResponse(Long id, String name, boolean active, boolean admin, String email, String department, JobRank jobRank) {
    this(id, name, active, admin, email, department, jobRank, null, null, false);
  }

  public MemberResponse(Long id, String name, boolean active, boolean admin, String email) {
    this(id, name, active, admin, email, null, null, null, null, false);
  }

  public static MemberResponse from(Member member) {
    return from(member, null);
  }

  public static MemberResponse from(Member member, String email) {
    return new MemberResponse(member.getId(), member.getName(), member.isActive(), member.isAdmin(), email,
      member.getDepartment(), member.getJobRank(), member.getPhone(), member.getExtension(), member.isDeveloper());
  }
}
