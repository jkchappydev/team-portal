package dev.jkchappy.portal.wbs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.when;

import dev.jkchappy.portal.TestcontainersConfig;
import dev.jkchappy.portal.attachment.FileStorage;
import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ClockConfig;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.document.Document;
import dev.jkchappy.portal.document.DocumentKind;
import dev.jkchappy.portal.document.DocumentRepository;
import dev.jkchappy.portal.document.DocumentService;
import dev.jkchappy.portal.document.TrashService;
import dev.jkchappy.portal.holiday.HolidayService;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.space.Space;
import dev.jkchappy.portal.space.SpaceRepository;
import dev.jkchappy.portal.wbs.dto.WbsResponse;
import dev.jkchappy.portal.wbs.dto.WbsRow;
import dev.jkchappy.portal.wbs.dto.WbsTaskUpdateRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

// 실제 DB 제약(하위 작업·담당자 연쇄 삭제) 아래에서 WBS 작업 조작을 검증
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({TestcontainersConfig.class, WbsService.class, DocumentService.class, TrashService.class, ClockConfig.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class WbsServiceTest {

  @Autowired
  private WbsService wbsService;

  @Autowired
  private DocumentService documentService;

  @Autowired
  private TrashService trashService;

  @Autowired
  private DocumentRepository documentRepository;

  @Autowired
  private SpaceRepository spaceRepository;

  @Autowired
  private WbsTaskRepository taskRepository;

  @Autowired
  private JdbcTemplate jdbcTemplate;

  @MockitoBean
  private MemberService memberService;

  @MockitoBean
  private HolidayService holidayService;

  @MockitoBean
  private FileStorage fileStorage;

  private Long memberId;

  @BeforeEach
  void setUp() {
    memberId = jdbcTemplate.queryForObject(
      "insert into member (name, active, created_at) values ('홍길동', true, now()) returning id", Long.class);
    Map<Long, String> names = new HashMap<>();
    names.put(memberId, "홍길동");
    when(memberService.findNamesByIds(anyCollection())).thenReturn(names);
    when(holidayService.findByMonth(any())).thenReturn(List.of());
  }

  private Long wbs() {
    Space space = spaceRepository.save(Space.create("개발", null, 1L));
    Document home = documentRepository.save(Document.create(space.getId(), "개발", 1L));
    space.assignHomeDocument(home.getId());
    spaceRepository.save(space);
    return documentService.create(space.getId(), "일정", null, DocumentKind.WBS, 1L).id();
  }

  private WbsTaskUpdateRequest leaf(String name, String start, String end, double progress, List<Long> assignees) {
    return new WbsTaskUpdateRequest(name, LocalDate.parse(start), LocalDate.parse(end), BigDecimal.valueOf(progress),
      assignees);
  }

  private List<String> names(WbsResponse response) {
    return response.tasks().stream().map(WbsRow::name).toList();
  }

  @Test
  void createWbs_hasWbsKindAndIcon() {
    Document doc = documentRepository.findById(wbs()).orElseThrow();

    assertThat(doc.isWbs()).isTrue();
    assertThat(doc.getIcon()).isEqualTo("📊");
  }

  @Test
  void createTask_insertsAtIndexAndIsSearchableByTaskName() {
    Long docId = wbs();
    Long a = wbsService.createTask(docId, null, null, 1L);
    Long b = wbsService.createTask(docId, null, null, 1L);
    wbsService.updateTask(a, leaf("요구사항 정의", "2023-06-01", "2023-06-09", 0, List.of()), 1L);
    wbsService.updateTask(b, leaf("착수보고", "2023-05-24", "2023-05-24", 0, List.of()), 1L);
    Long first = wbsService.createTask(docId, null, 0, 1L);

    WbsResponse response = wbsService.get(docId, LocalDate.of(2023, 6, 1));

    assertThat(response.tasks()).extracting(WbsRow::id).containsExactly(first, a, b);
    assertThat(documentRepository.findById(docId).orElseThrow().getPlainText()).isEmpty();
    // 5/24~6/9 작업 → 5/21이 속한 5월 1일 ~ 6/16이 속한 6월 말일
    assertThat(response.rangeStart()).isEqualTo(LocalDate.of(2023, 5, 1));
    assertThat(response.rangeEnd()).isEqualTo(LocalDate.of(2023, 6, 30));
  }

  @Test
  void scheduleInPage_isHiddenFromTreeAndFoundThroughPageByTaskName() {
    Long wbsId = wbs();
    Long spaceId = documentRepository.findById(wbsId).orElseThrow().getSpaceId();
    Long pageId = documentService.create(spaceId, "기획", null, 1L).id();
    Long scheduleId = documentService.create(spaceId, "일정", pageId, DocumentKind.WBS, 1L).id();
    Long task = wbsService.createTask(scheduleId, null, null, 1L);
    wbsService.updateTask(task, leaf("착수보고", "2023-05-24", "2023-05-24", 0, List.of()), 1L);

    // 사이드바 트리에는 페이지만 보이고 WBS는 숨김
    assertThat(documentService.findBySpace(spaceId)).extracting(s -> s.id()).containsExactly(pageId);
    // 작업명으로 찾으면 일정이 들어 있는 페이지가 나오고 WBS 자체는 나오지 않음
    assertThat(documentRepository.search("%착수보고%")).extracting(Document::getId)
      .contains(pageId).doesNotContain(scheduleId, wbsId);
  }

  @Test
  void createChild_clearsParentScheduleAndRejectsParentDates() {
    Long docId = wbs();
    Long parent = wbsService.createTask(docId, null, null, 1L);
    wbsService.updateTask(parent, leaf("분석", "2023-06-01", "2023-06-09", 30, List.of()), 1L);

    Long child = wbsService.createTask(docId, parent, null, 1L);

    WbsTask stored = taskRepository.findById(parent).orElseThrow();
    assertThat(stored.getStartDate()).isNull();
    assertThat(stored.getProgress().signum()).isZero();
    assertThat(wbsService.get(docId, LocalDate.now()).tasks().get(1).id()).isEqualTo(child);
    assertThatThrownBy(() -> wbsService.updateTask(parent, leaf("분석", "2023-06-01", "2023-06-09", 0, List.of()), 1L))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
  }

  @Test
  void updateTask_storesAssigneesAndRejectsReversedDates() {
    Long docId = wbs();
    Long task = wbsService.createTask(docId, null, null, 1L);

    wbsService.updateTask(task, leaf("통계", "2023-06-19", "2023-06-23", 40, List.of(memberId)), 1L);

    WbsRow row = wbsService.get(docId, LocalDate.of(2023, 6, 30)).tasks().get(0);
    assertThat(row.assignees()).extracting(WbsRow.WbsAssignee::name).containsExactly("홍길동");
    assertThat(row.actualPercent()).isEqualTo(40);
    assertThatThrownBy(() -> wbsService.updateTask(task, leaf("통계", "2023-06-23", "2023-06-19", 0, List.of()), 1L))
      .isInstanceOf(BusinessException.class);
  }

  @Test
  void moveTask_intoOwnDescendant_rejected() {
    Long docId = wbs();
    Long parent = wbsService.createTask(docId, null, null, 1L);
    Long child = wbsService.createTask(docId, parent, null, 1L);

    assertThatThrownBy(() -> wbsService.moveTask(parent, child, null, 1L))
      .isInstanceOf(BusinessException.class);
    assertThatThrownBy(() -> wbsService.moveTask(parent, parent, null, 1L))
      .isInstanceOf(BusinessException.class);
  }

  @Test
  void moveTask_changesParentAndOrder() {
    Long docId = wbs();
    Long a = wbsService.createTask(docId, null, null, 1L);
    Long b = wbsService.createTask(docId, null, null, 1L);
    Long c = wbsService.createTask(docId, null, null, 1L);

    wbsService.moveTask(c, a, 0, 1L);
    wbsService.moveTask(b, null, 0, 1L);

    List<WbsRow> rows = wbsService.get(docId, LocalDate.now()).tasks();
    assertThat(rows).extracting(WbsRow::id).containsExactly(b, a, c);
    assertThat(rows.get(2).parentId()).isEqualTo(a);
  }

  @Test
  void deleteTask_removesChildrenAndAssignees() {
    Long docId = wbs();
    Long parent = wbsService.createTask(docId, null, null, 1L);
    Long child = wbsService.createTask(docId, parent, null, 1L);
    wbsService.updateTask(child, leaf("회원관리", "2023-06-15", "2023-06-27", 0, List.of(memberId)), 1L);

    wbsService.deleteTask(parent, 1L);

    assertThat(taskRepository.findById(child)).isEmpty();
    assertThat(jdbcTemplate.queryForObject("select count(*) from wbs_task_assignee where task_id = ?",
      Integer.class, child)).isZero();
    assertThat(wbsService.get(docId, LocalDate.now()).tasks()).isEmpty();
  }

  @Test
  void trashedWbs_tasksNotAccessible_andPurgeRemovesTasks() {
    Long docId = wbs();
    Long task = wbsService.createTask(docId, null, null, 1L);
    wbsService.updateTask(task, leaf("통계", "2023-06-19", "2023-06-23", 0, List.of(memberId)), 1L);
    documentService.delete(docId);

    assertThatThrownBy(() -> wbsService.get(docId, LocalDate.now()))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    assertThatThrownBy(() -> wbsService.createTask(docId, null, null, 1L))
      .isInstanceOf(BusinessException.class);

    trashService.purgeDocument(docId);

    assertThat(taskRepository.findById(task)).isEmpty();
    assertThat(documentRepository.findById(docId)).isEmpty();
  }

  @Test
  void pageDocument_isNotWbs() {
    Long docId = wbs();
    Document doc = documentRepository.findById(docId).orElseThrow();
    Long pageId = documentService.create(doc.getSpaceId(), "페이지", null, 1L).id();

    assertThatThrownBy(() -> wbsService.get(pageId, LocalDate.now()))
      .isInstanceOfSatisfying(BusinessException.class,
        e -> assertThat(e.getErrorCode()).isEqualTo(ErrorCode.NOT_FOUND));
    assertThatThrownBy(() -> documentService.create(doc.getSpaceId(), "하위", docId, 1L))
      .isInstanceOf(BusinessException.class);
  }

  @Test
  void names_reflectDisplayOrder() {
    Long docId = wbs();
    Long a = wbsService.createTask(docId, null, null, 1L);
    wbsService.updateTask(a, leaf("가", "2023-06-01", "2023-06-01", 0, List.of()), 1L);

    assertThat(names(wbsService.get(docId, LocalDate.now()))).containsExactly("가");
  }
}
