package dev.jkchappy.portal.account;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, Long> {
  Optional<Account> findByEmail(String email);

  Optional<Account> findByGoogleSubject(String googleSubject);
  boolean existsByMemberId(Long memberId);
  Optional<Account> findByMemberId(Long memberId);
  List<Account> findByStatusInOrderByRequestedAtAsc(Collection<AccountStatus> statuses);
  long countByStatus(AccountStatus status);
  List<Account> findByMemberIdIn(Collection<Long> memberIds);
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select a from Account a where a.id = :id")
  Optional<Account> findForUpdateById(@Param("id") Long id);
}
