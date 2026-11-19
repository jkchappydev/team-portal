package dev.jkchappy.portal.form;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.form.dto.FormResponse;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(FormTemplateController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class FormTemplateControllerTest {

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private FormTemplateService formService;

  @MockitoBean
  private MemberService memberService;

  @Autowired
  private MockMvc mockMvc;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }

  @Test
  void list_withoutUser_returns401() throws Exception {
    mockMvc.perform(get("/api/forms")).andExpect(status().isUnauthorized());
  }

  @Test
  void upload_passesFileAndUser() throws Exception {
    when(formService.upload(any(), eq(3L))).thenReturn(new FormResponse(1L, "휴가 신청서.docx",
      "application/octet-stream", 3L, "가나다", OffsetDateTime.parse("2026-11-18T00:00:00Z"), "/api/forms/1/download"));
    MockMultipartFile file = new MockMultipartFile("file", "휴가 신청서.docx", "application/octet-stream",
      "abc".getBytes());

    mockMvc.perform(multipart("/api/forms").file(file).with(loginAs(3L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.name").value("휴가 신청서.docx"))
      .andExpect(jsonPath("$.data.url").value("/api/forms/1/download"));
    verify(formService).upload(any(), eq(3L));
  }

  @Test
  void move_negativeIndex_returns400() throws Exception {
    mockMvc.perform(patch("/api/forms/1/position")
        .with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"index\":-1}"))
      .andExpect(status().isBadRequest());
  }

  // 한글 파일명을 유지한 다운로드로 내려줌
  @Test
  void download_sendsAttachmentWithKoreanName() throws Exception {
    FormTemplate form = FormTemplate.create("휴가 신청서.pdf", "stored", "application/pdf", 3L, 0, 1L);
    when(formService.download(1L)).thenReturn(new FormTemplateService.Download(form,
      new ByteArrayResource("abc".getBytes(StandardCharsets.UTF_8))));

    mockMvc.perform(get("/api/forms/1/download").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(header().string("Content-Disposition",
        org.hamcrest.Matchers.allOf(org.hamcrest.Matchers.startsWith("attachment"),
          org.hamcrest.Matchers.containsString("filename*=UTF-8''"))))
      .andExpect(header().string("X-Content-Type-Options", "nosniff"))
      .andExpect(content().bytes("abc".getBytes(StandardCharsets.UTF_8)));
  }

  // 휴지통에서 되살리기
  @Test
  void restore_callsService() throws Exception {
    mockMvc.perform(post("/api/forms/4/restore").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.success").value(true));

    verify(formService).restore(4L);
  }
}
