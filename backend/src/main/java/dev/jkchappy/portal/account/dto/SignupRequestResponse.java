package dev.jkchappy.portal.account.dto;

import dev.jkchappy.portal.account.Account;
import dev.jkchappy.portal.member.JobRank;
import dev.jkchappy.portal.member.Member;

import dev.jkchappy.portal.account.AccountStatus;
import java.time.Instant;

// previous*: 삭제된 팀원의 재가입이면 이전 팀원 정보 (승인 시 기본으로 다시 연결)
public record SignupRequestResponse(Long id, String email, String googleName, AccountStatus status, Instant requestedAt,
  Long previousMemberId, String previousMemberName, String previousDepartment, JobRank previousJobRank) {

  public static SignupRequestResponse from(Account account) {
    Member previous = account.previousMember();
    return new SignupRequestResponse(account.getId(), account.getEmail(), account.getGoogleName(), account.getStatus(),
      account.getRequestedAt(), previous == null ? null : previous.getId(), previous == null ? null : previous.getName(),
      previous == null ? null : previous.getDepartment(), previous == null ? null : previous.getJobRank());
  }
}
