package dev.jkchappy.portal.member.dto;

import jakarta.validation.constraints.Size;
import dev.jkchappy.portal.member.JobRank;

public record MemberUpdateRequest(@Size(max = 50) String name, Boolean active, @Size(max = 100) String department, JobRank jobRank) {
  public MemberUpdateRequest(String name, Boolean active) { this(name, active, null, null); }
}
