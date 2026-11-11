package dev.jkchappy.portal.member.dto;

import jakarta.validation.constraints.Size;
import dev.jkchappy.portal.member.JobRank;

// phone, extension: null이면 그대로, 빈 문자열은 거부 (필수 값)
public record MemberUpdateRequest(@Size(max = 50) String name, Boolean active, @Size(max = 100) String department, JobRank jobRank,
  @Size(max = 20) String phone, @Size(max = 10) String extension) {
  public MemberUpdateRequest(String name, Boolean active) { this(name, active, null, null, null, null); }
  public MemberUpdateRequest(String name, Boolean active, String department, JobRank jobRank) { this(name, active, department, jobRank, null, null); }
  public MemberUpdateRequest(String name, Boolean active, String department, JobRank jobRank, String phone) {
    this(name, active, department, jobRank, phone, null);
  }
}
