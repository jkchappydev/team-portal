package dev.jkchappy.portal.document.property;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.property.dto.PropertyResponse;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(DocumentPropertyController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class DocumentPropertyControllerTest {

  @MockitoBean
  private AccountService accountService;

  @MockitoBean
  private DocumentPropertyService propertyService;

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
    mockMvc.perform(get("/api/documents/5/properties")).andExpect(status().isUnauthorized());
  }

  @Test
  void list_returnsProperties() throws Exception {
    when(propertyService.list(5L)).thenReturn(List.of(new PropertyResponse(1L, "담당자", PropertyType.PERSON, "3,1")));

    mockMvc.perform(get("/api/documents/5/properties").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data[0].name").value("담당자"))
      .andExpect(jsonPath("$.data[0].type").value("PERSON"))
      .andExpect(jsonPath("$.data[0].value").value("3,1"));
  }

  // 이름은 필수, 종류는 정해진 값만
  @Test
  void create_invalid_returns400() throws Exception {
    mockMvc.perform(post("/api/documents/5/properties").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\" \",\"type\":\"TEXT\"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
    mockMvc.perform(post("/api/documents/5/properties").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"상태\",\"type\":\"SELECT\"}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void changeValue_returnsUpdatedProperty() throws Exception {
    when(propertyService.changeValue(5L, 1L, "2026-11-30", 1L))
      .thenReturn(new PropertyResponse(1L, "마감", PropertyType.DATE, "2026-11-30"));

    mockMvc.perform(put("/api/documents/5/properties/1/value").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON).content("{\"value\":\"2026-11-30\"}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.value").value("2026-11-30"));
  }
}
