package dev.jkchappy.portal.space;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import dev.jkchappy.portal.common.GlobalExceptionHandler;
import dev.jkchappy.portal.common.WebConfig;
import dev.jkchappy.portal.member.CurrentUserArgumentResolver;
import dev.jkchappy.portal.member.MemberService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(SpaceController.class)
@Import({GlobalExceptionHandler.class, WebConfig.class, CurrentUserArgumentResolver.class,
  dev.jkchappy.portal.document.InternalTokenInterceptor.class})
class SpaceControllerTest {

  @Autowired
  private MockMvc mockMvc;

  @MockitoBean
  private SpaceService spaceService;

  @MockitoBean
  private MemberService memberService;

  @Test
  void createSpace_blankName_returns400() throws Exception {
    mockMvc.perform(post("/api/spaces")
        .header("X-User-Id", "1")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"  \"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void createSpace_withoutUser_returns401() throws Exception {
    mockMvc.perform(post("/api/spaces")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"개발\"}"))
      .andExpect(status().isUnauthorized());
  }
}
