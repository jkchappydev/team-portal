package dev.jkchappy.portal.annualleave;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AnnualLeaveBalanceRepository extends JpaRepository<AnnualLeaveBalance, Long> {

  List<AnnualLeaveBalance> findByYear(int year);

  Optional<AnnualLeaveBalance> findByMemberIdAndYear(Long memberId, int year);
}
