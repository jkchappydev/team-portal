package dev.jkchappy.portal.member.dto;

import jakarta.validation.constraints.Size;
import dev.jkchappy.portal.member.JobRank;

// phone: null이면 그대로, 빈 문자열이면 지움
public record MemberUpdateRequest(@Size(max = 50) String name, Boolean active, @Size(max = 100) String department, JobRank jobRank,
  @Size(max = 20) String phone) {
  public MemberUpdateRequest(String name, Boolean active) { this(name, active, null, null, null); }
  public MemberUpdateRequest(String name, Boolean active, String department, JobRank jobRank) { this(name, active, department, jobRank, null); }
}
