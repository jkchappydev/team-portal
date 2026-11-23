package dev.jkchappy.portal.document;

import static org.mockito.Mockito.when;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.common.BusinessException;
import dev.jkchappy.portal.common.ErrorCode;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.Mockito.lenient;
import static org.mockito.ArgumentMatchers.anyString;
import org.junit.jupiter.api.BeforeEach;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest({DocumentController.class, TrashController.class})
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class DocumentControllerTest {
  @MockitoBean
  private AccountService accountService;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }


  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private DocumentService documentService;

  @MockitoBean
  private MemberService memberService;

  @MockitoBean
  private TrashService trashService;

  @MockitoBean
  private dev.jkchappy.portal.form.FormTemplateService formService;

  @MockitoBean
  private dev.jkchappy.portal.document.property.DocumentPropertyService propertyService;

  @Test
  void deleteDocument_withoutUser_returns401() throws Exception {
    mockMvc.perform(delete("/api/documents/1"))
      .andExpect(status().isUnauthorized())
      .andExpect(jsonPath("$.error.code").value("UNAUTHENTICATED"));
  }

  // 본문을 처음 연 사람이 기존 하위 항목 ID를 가져가 페이지 블록으로 붙임
  @Test
  void claimPageBlockBackfill_returnsChildIds() throws Exception {
    when(documentService.claimPageBlockBackfill(7L)).thenReturn(List.of(11L, 12L));

    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .post("/api/documents/7/page-block-backfill").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[0]").value(11))
      .andExpect(jsonPath("$.data[1]").value(12));
  }

  // 페이지 블록 복제: 새로 만든 사본 페이지 정보를 돌려줌
  @Test
  void duplicate_returnsCopiedDocument() throws Exception {
    when(documentService.duplicate(7L, 1L, null)).thenReturn(new dev.jkchappy.portal.document.dto.DocumentSummary(
      20L, 10L, "개발", "회의록 (사본)", null, "작성자", java.time.OffsetDateTime.parse("2026-11-16T00:00:00Z"),
      3L, "PAGE", null));

    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .post("/api/documents/7/duplicate").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.id").value(20))
      .andExpect(jsonPath("$.data.title").value("회의록 (사본)"));
    // 복제본에 원본 속성(담당자 등)을 복사
    org.mockito.Mockito.verify(propertyService).copyProperties(7L, 20L);
  }

  // 프로젝트 커버 변경: 바뀐 문서 상세(커버 포함)를 돌려줌
  @Test
  void changeCover_returnsDetailWithCover() throws Exception {
    when(documentService.changeCover(1L, "att:7", 1L)).thenReturn(new dev.jkchappy.portal.document.dto.DocumentDetail(
      1L, 10L, "개발", "개발", null, "att:7", "작성자", "작성자",
      java.time.OffsetDateTime.parse("2026-11-17T00:00:00Z"), true, null, List.of(), "PAGE", null));

    mockMvc.perform(patch("/api/documents/1/cover")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"cover\":\"att:7\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.cover").value("att:7"));
  }

  @Test
  void renameDocument_blankTitle_returns400() throws Exception {
    mockMvc.perform(patch("/api/documents/1/title")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"title\":\"\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void changeIcon_tooLong_returns400() throws Exception {
    mockMvc.perform(patch("/api/documents/1/icon")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"" + "a".repeat(513) + "\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void changeIcon_withoutUser_returns401() throws Exception {
    mockMvc.perform(patch("/api/documents/1/icon")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"🚀\"}"))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void changeIcon_returnsDetail() throws Exception {
    when(documentService.changeIcon(1L, "🚀", 1L)).thenReturn(new dev.jkchappy.portal.document.dto.DocumentDetail(
      1L, 10L, "개발", "문서", "🚀", null, "홍길동", "홍길동", null, false, null, List.of(), "PAGE", null));

    mockMvc.perform(patch("/api/documents/1/icon")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"icon\":\"🚀\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.icon").value("🚀"));
  }

  // 메인 화면 최근 수정된 게시글은 10개까지 (주소 recent가 문서 번호 자리로 해석되지 않음)
  @Test
  void recent_returnsLatestTen() throws Exception {
    when(documentService.findRecent(10)).thenReturn(List.of());

    mockMvc.perform(get("/api/documents/recent"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));
  }

  @Test
  void search_returnsApiResponse() throws Exception {
    when(documentService.search("배포")).thenReturn(List.of());

    mockMvc.perform(get("/api/documents/search").param("q", "배포"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));
  }

  @Test
  void purgeDocument_callsTrashService() throws Exception {
    mockMvc.perform(delete("/api/trash/documents/3").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));

    verify(trashService).purgeDocument(3L);
  }

  @Test
  void purgeSpace_callsTrashService() throws Exception {
    mockMvc.perform(delete("/api/trash/spaces/9").with(loginAs(1L)))
      .andExpect(status().isOk());

    verify(trashService).purgeSpace(9L);
  }

  @Test
  void purgeDocument_notInTrash_returns400() throws Exception {
    doThrow(new BusinessException(ErrorCode.INVALID_INPUT, "휴지통에 있는 페이지만 영구 삭제할 수 있습니다."))
      .when(trashService).purgeDocument(3L);

    mockMvc.perform(delete("/api/trash/documents/3").with(loginAs(1L)))
      .andExpect(status().isBadRequest());
  }

  @Test
  void purgeDocument_withoutUser_returns401() throws Exception {
    mockMvc.perform(delete("/api/trash/documents/3"))
      .andExpect(status().isUnauthorized());
  }

  // 휴지통 목록은 페이지·프로젝트와 공유 보관함 파일을 최근 삭제순으로 합침
  @Test
  void trash_mergesFormsByDeletedAt() throws Exception {
    when(documentService.findTrash()).thenReturn(new dev.jkchappy.portal.document.dto.TrashResponse(List.of(
      new dev.jkchappy.portal.document.dto.TrashItem("document", 3L, "회의록", null, null,
        java.time.OffsetDateTime.parse("2026-11-18T00:00:00Z"), List.of()))));
    when(formService.findTrash()).thenReturn(List.of(
      new dev.jkchappy.portal.document.dto.TrashItem("form", 7L, "품의서.xlsx", null, null,
        java.time.OffsetDateTime.parse("2026-11-19T00:00:00Z"), List.of())));

    mockMvc.perform(get("/api/trash").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.items[0].kind").value("form"))
      .andExpect(jsonPath("$.data.items[0].name").value("품의서.xlsx"))
      .andExpect(jsonPath("$.data.items[1].kind").value("document"));
  }

  @Test
  void purgeForm_callsFormService() throws Exception {
    mockMvc.perform(delete("/api/trash/forms/7").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));

    verify(formService).purge(7L);
  }

  // 본문에 복사해 붙여넣은 페이지: 붙여넣은 페이지 아래에 사본을 만들도록 상위 페이지를 넘김
  @Test
  void duplicate_withParentId_passesTargetParent() throws Exception {
    when(documentService.duplicate(7L, 1L, 50L)).thenReturn(new dev.jkchappy.portal.document.dto.DocumentSummary(
      21L, 20L, "운영", "회의록 (사본)", null, "작성자", java.time.OffsetDateTime.parse("2026-11-23T00:00:00Z"),
      null, "PAGE", null));

    mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .post("/api/documents/7/duplicate").param("parentId", "50").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.id").value(21));

    verify(propertyService).copyProperties(7L, 21L);
  }
}
