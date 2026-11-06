package dev.jkchappy.portal.wbs;

import static dev.jkchappy.portal.support.ControllerTestSecurity.loginAs;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.account.AccountService;
import dev.jkchappy.portal.common.ClockConfig;
import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.document.InternalTokenInterceptor;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.support.ControllerTestSecurity;
import dev.jkchappy.portal.wbs.dto.WbsResponse;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WbsController.class)
@Import({ControllerTestSecurity.class, GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  InternalTokenInterceptor.class, ClockConfig.class})
class WbsControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private WbsService wbsService;

  @MockitoBean
  private AccountService accountService;

  @BeforeEach
  void stubAuthenticatedMember() {
    lenient().when(accountService.requireActiveMemberId(anyString())).thenAnswer(invocation ->
      Long.parseLong(invocation.<String>getArgument(0).substring("test-sub-".length())));
  }

  @Test
  void get_passesBaseDate() throws Exception {
    LocalDate base = LocalDate.of(2023, 6, 5);
    when(wbsService.get(5L, base)).thenReturn(new WbsResponse(5L, base, null, List.of(), base, base, List.of()));

    mockMvc.perform(get("/api/wbs/5").param("baseDate", "2023-06-05").with(loginAs(1L)))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data.baseDate").value("2023-06-05"));
  }

  @Test
  void get_withoutUser_returns401() throws Exception {
    mockMvc.perform(get("/api/wbs/5"))
      .andExpect(status().isUnauthorized());
  }

  @Test
  void createTask_returnsNewId() throws Exception {
    when(wbsService.createTask(5L, 3L, 0, 1L)).thenReturn(10L);

    mockMvc.perform(post("/api/wbs/5/tasks").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"parentId\":3,\"index\":0}"))
      .andExpect(status().isOk())
      .andExpect(jsonPath("$.data").value(10));
  }

  @Test
  void updateTask_blankName_returns400() throws Exception {
    mockMvc.perform(put("/api/wbs/tasks/10").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\" \",\"progress\":10}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void updateTask_progressOver100_returns400() throws Exception {
    mockMvc.perform(put("/api/wbs/tasks/10").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"통계\",\"progress\":101}"))
      .andExpect(status().isBadRequest());
  }

  @Test
  void updateTask_valid_callsService() throws Exception {
    mockMvc.perform(put("/api/wbs/tasks/10").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"통계\",\"startDate\":\"2023-06-19\",\"endDate\":\"2023-06-23\",\"progress\":40,\"assigneeIds\":[2]}"))
      .andExpect(status().isOk());

    verify(wbsService).updateTask(eq(10L), any(), eq(1L));
  }

  @Test
  void moveAndDelete_callService() throws Exception {
    mockMvc.perform(patch("/api/wbs/tasks/10/position").with(loginAs(1L))
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"parentId\":null,\"index\":2}"))
      .andExpect(status().isOk());
    mockMvc.perform(delete("/api/wbs/tasks/10").with(loginAs(1L)))
      .andExpect(status().isOk());

    verify(wbsService).moveTask(10L, null, 2, 1L);
    verify(wbsService).deleteTask(10L, 1L);
  }
}
