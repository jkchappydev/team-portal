package dev.jkchappy.portal.wbs;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.holiday.HolidayService;
import dev.jkchappy.portal.holiday.dto.HolidayResponse;
import dev.jkchappy.portal.live.LiveUpdateEvent;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.wbs.dto.WbsResponse;
import dev.jkchappy.portal.wbs.dto.WbsTaskUpdateRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WbsService {

  // 간트 차트 앞뒤 여유 날짜
  private static final int RANGE_BEFORE_DAYS = 3;
  private static final int RANGE_AFTER_DAYS = 7;
  // 작업이 없거나 날짜가 없을 때 보여줄 기본 기간
  private static final int EMPTY_RANGE_DAYS = 28;
  // 공휴일을 조회할 최대 개월 수 (외부 API 호출 상한)
  private static final int MAX_HOLIDAY_MONTHS = 36;
  private static final int MAX_DEPTH = 30;

  private final WbsTaskRepository taskRepository;
  private final DocumentService documentService;
  private final MemberService memberService;
  private final HolidayService holidayService;
  private final ApplicationEventPublisher events;

  // 작업 줄 계산 결과와 간트 차트 범위의 공휴일
  @Transactional(readOnly = true)
  public WbsResponse get(Long documentId, LocalDate baseDate) {
    getLiveWbs(documentId);
    List<WbsTask> tasks = taskRepository.findByDocumentIdOrderBySortOrderAscIdAsc(documentId);
    LocalDate[] range = range(tasks, baseDate);
    List<HolidayResponse> holidays = holidaysBetween(range[0], range[1]);
    Set<LocalDate> holidayDates = holidays.stream().map(HolidayResponse::date).collect(Collectors.toSet());
    Set<Long> memberIds = new HashSet<>();
    tasks.forEach(t -> memberIds.addAll(t.getAssigneeIds()));
    Map<Long, String> names = memberIds.isEmpty() ? Map.of() : memberService.findNamesByIds(memberIds);
    WbsCalculator.Result result = WbsCalculator.calculate(tasks, holidayDates, baseDate, names);
    return new WbsResponse(documentId, baseDate, result.summary(), result.tasks(), range[0], range[1], holidays);
  }

  // parentId 아래 index 위치에 새 작업 추가 (index가 없으면 맨 아래)
  @Transactional
  public Long createTask(Long documentId, Long parentId, Integer index, Long userId) {
    getLiveWbs(documentId);
    if (parentId != null) {
      getTaskIn(documentId, parentId).clearSchedule(userId);
    }
    WbsTask task = taskRepository.save(WbsTask.create(documentId, parentId, WbsTask.DEFAULT_NAME, userId));
    placeAmongSiblings(task, index);
    afterChange(documentId, userId);
    return task.getId();
  }

  // 이름·날짜·진척률·담당자 저장 (하위 작업이 있는 작업은 날짜·진척률을 입력할 수 없음)
  @Transactional
  public void updateTask(Long taskId, WbsTaskUpdateRequest request, Long userId) {
    WbsTask task = getLiveTask(taskId);
    boolean group = hasChildren(task);
    BigDecimal progress = request.progress() == null ? BigDecimal.ZERO : request.progress();
    if (group && (request.startDate() != null || request.endDate() != null || progress.signum() != 0)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "하위 작업이 있는 작업은 날짜와 진척률을 하위 작업에서 계산합니다.");
    }
    if (request.startDate() != null && request.endDate() != null && request.endDate().isBefore(request.startDate())) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "완료일은 시작일보다 빠를 수 없습니다.");
    }
    Set<Long> assigneeIds = new LinkedHashSet<>(request.assigneeIds() == null ? List.of() : request.assigneeIds());
    if (!assigneeIds.isEmpty() && !memberService.findNamesByIds(assigneeIds).keySet().containsAll(assigneeIds)) {
      throw new BusinessException(ErrorCode.INVALID_INPUT, "없는 팀원은 담당자로 지정할 수 없습니다.");
    }
    task.change(request.name().trim(), request.startDate(), request.endDate(), progress, assigneeIds, userId);
    afterChange(task.getDocumentId(), userId);
  }

  // 다른 작업 아래(또는 최상위)의 index 위치로 이동, 하위 작업은 함께 따라옴
  @Transactional
  public void moveTask(Long taskId, Long parentId, Integer index, Long userId) {
    WbsTask task = getLiveTask(taskId);
    if (parentId != null) {
      if (parentId.equals(taskId)) {
        throw new BusinessException(ErrorCode.INVALID_INPUT, "자기 자신 아래로는 옮길 수 없습니다.");
      }
      WbsTask parent = getTaskIn(task.getDocumentId(), parentId);
      if (isAncestorOf(task, parent)) {
        throw new BusinessException(ErrorCode.INVALID_INPUT, "하위 작업 안으로는 옮길 수 없습니다.");
      }
      parent.clearSchedule(userId);
    }
    task.placeUnder(parentId);
    placeAmongSiblings(task, index);
    afterChange(task.getDocumentId(), userId);
  }

  // 하위 작업과 함께 삭제
  @Transactional
  public void deleteTask(Long taskId, Long userId) {
    WbsTask task = getLiveTask(taskId);
    Long documentId = task.getDocumentId();
    taskRepository.deleteWithChildren(taskId);
    afterChange(documentId, userId);
  }

  // 휴지통에 있거나 WBS가 아닌 문서는 없는 것으로 취급
  private Document getLiveWbs(Long documentId) {
    Document doc = documentService.getLiveDocument(documentId);
    if (!doc.isWbs()) {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }
    return doc;
  }

  private WbsTask getLiveTask(Long taskId) {
    WbsTask task = taskRepository.findById(taskId)
      .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND));
    getLiveWbs(task.getDocumentId());
    return task;
  }

  private WbsTask getTaskIn(Long documentId, Long taskId) {
    return taskRepository.findById(taskId)
      .filter(t -> t.getDocumentId().equals(documentId))
      .orElseThrow(() -> new BusinessException(ErrorCode.INVALID_INPUT, "같은 WBS 안의 작업만 상위로 지정할 수 있습니다."));
  }

  private boolean hasChildren(WbsTask task) {
    return taskRepository.findByDocumentIdOrderBySortOrderAscIdAsc(task.getDocumentId()).stream()
      .anyMatch(t -> task.getId().equals(t.getParentId()));
  }

  // target의 상위 경로에 task가 있으면 task 아래로 옮기는 것이라 순환이 생김
  private boolean isAncestorOf(WbsTask task, WbsTask target) {
    Long parentId = target.getParentId();
    int depth = 0;
    while (parentId != null && depth++ < MAX_DEPTH) {
      if (parentId.equals(task.getId())) {
        return true;
      }
      parentId = taskRepository.findById(parentId).map(WbsTask::getParentId).orElse(null);
    }
    return false;
  }

  // 같은 상위 아래 형제 사이에 끼워 넣고 0부터 다시 번호를 매김
  private void placeAmongSiblings(WbsTask task, Integer index) {
    List<WbsTask> siblings = new ArrayList<>(taskRepository.findByDocumentIdOrderBySortOrderAscIdAsc(task.getDocumentId())
      .stream()
      .filter(t -> Objects.equals(t.getParentId(), task.getParentId()) && !t.getId().equals(task.getId()))
      .toList());
    int position = index == null ? siblings.size() : Math.clamp(index, 0, siblings.size());
    siblings.add(position, task);
    for (int i = 0; i < siblings.size(); i++) {
      siblings.get(i).changeSortOrder(i);
    }
  }

  // WBS 문서의 수정자·수정 시각을 갱신하고 열려 있는 화면에 변경 알림 (작업명 검색은 검색 쿼리가 wbs_task를 직접 조회)
  private void afterChange(Long documentId, Long userId) {
    getLiveWbs(documentId).touch(userId);
    events.publishEvent(new LiveUpdateEvent(LiveUpdateEvent.WBS));
  }

  // 가장 이른 시작일 3일 전이 속한 달 1일 ~ 가장 늦은 완료일 7일 뒤가 속한 달 말일 (참고 양식처럼 달 단위로 표시)
  // 날짜가 없으면 기준일 주변 4주가 걸친 달
  private LocalDate[] range(List<WbsTask> tasks, LocalDate baseDate) {
    LocalDate start = null;
    LocalDate end = null;
    for (WbsTask task : tasks) {
      for (LocalDate date : new LocalDate[] {task.getStartDate(), task.getEndDate()}) {
        if (date == null) continue;
        start = start == null || date.isBefore(start) ? date : start;
        end = end == null || date.isAfter(end) ? date : end;
      }
    }
    LocalDate from = start == null ? baseDate.minusDays(RANGE_BEFORE_DAYS) : start.minusDays(RANGE_BEFORE_DAYS);
    LocalDate to = start == null ? baseDate.plusDays(EMPTY_RANGE_DAYS) : end.plusDays(RANGE_AFTER_DAYS);
    return new LocalDate[] {from.withDayOfMonth(1), YearMonth.from(to).atEndOfMonth()};
  }

  // 범위 안의 공휴일 (조회 개월 수 상한을 넘으면 앞쪽부터 상한까지만)
  private List<HolidayResponse> holidaysBetween(LocalDate start, LocalDate end) {
    List<HolidayResponse> result = new ArrayList<>();
    YearMonth month = YearMonth.from(start);
    YearMonth last = YearMonth.from(end);
    for (int i = 0; !month.isAfter(last) && i < MAX_HOLIDAY_MONTHS; i++, month = month.plusMonths(1)) {
      holidayService.findByMonth(month).stream()
        .filter(h -> !h.date().isBefore(start) && !h.date().isAfter(end))
        .forEach(result::add);
    }
    return result;
  }
}
