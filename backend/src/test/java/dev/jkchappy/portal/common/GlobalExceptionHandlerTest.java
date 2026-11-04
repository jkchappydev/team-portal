package dev.jkchappy.portal.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc = MockMvcBuilders.standaloneSetup(new TestController())
      .setControllerAdvice(new GlobalExceptionHandler())
      .build();
  }

  @Test
  void businessException_mapsToStatusAndBody() throws Exception {
    mockMvc.perform(get("/test/not-found"))
      .andExpect(status().isNotFound())
      .andExpect(jsonPath("$.success").value(false))
      .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
      .andExpect(jsonPath("$.data").doesNotExist());
  }

  @Test
  void validationError_returns400InvalidInput() throws Exception {
    mockMvc.perform(post("/test/validate")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{\"name\":\"\"}"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.success").value(false))
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void unexpectedException_returns500WithoutStackTrace() throws Exception {
    mockMvc.perform(get("/test/boom"))
      .andExpect(status().isInternalServerError())
      .andExpect(jsonPath("$.error.code").value("INTERNAL_ERROR"))
      .andExpect(jsonPath("$.error.message").value(
        org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("secret detail"))));
  }

  @Test
  void malformedJson_returns400InvalidInput() throws Exception {
    mockMvc.perform(post("/test/validate")
        .contentType(MediaType.APPLICATION_JSON)
        .content("{not json"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void missingRequestParam_returns400InvalidInput() throws Exception {
    mockMvc.perform(get("/test/param"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void paramTypeMismatch_returns400InvalidInput() throws Exception {
    mockMvc.perform(get("/test/param").param("n", "abc"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void noResourceFound_returns404NotFound() {
    var response = new GlobalExceptionHandler().handleNoResource(
      new org.springframework.web.servlet.resource.NoResourceFoundException(
        org.springframework.http.HttpMethod.GET, "/x", "x"));

    org.assertj.core.api.Assertions.assertThat(response.getStatusCode().value()).isEqualTo(404);
    org.assertj.core.api.Assertions.assertThat(response.getBody().error().code()).isEqualTo("NOT_FOUND");
  }

  @Test
  void unsupportedMethod_returns405() throws Exception {
    mockMvc.perform(post("/test/not-found"))
      .andExpect(status().isMethodNotAllowed())
      .andExpect(header().string("Allow", org.hamcrest.Matchers.containsString("GET")))
      .andExpect(jsonPath("$.success").value(false))
      .andExpect(jsonPath("$.error.code").value("METHOD_NOT_ALLOWED"));
  }

  @Test
  void unsupportedMediaType_returns415() throws Exception {
    mockMvc.perform(post("/test/validate")
        .contentType(MediaType.TEXT_PLAIN)
        .content("name"))
      .andExpect(status().isUnsupportedMediaType())
      .andExpect(jsonPath("$.success").value(false))
      .andExpect(jsonPath("$.error.code").value("UNSUPPORTED_MEDIA_TYPE"));
  }

  @Test
  void missingRequestPart_returns400InvalidInput() throws Exception {
    mockMvc.perform(multipart("/test/upload"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @Test
  void missingRequestHeader_returns400InvalidInput() throws Exception {
    mockMvc.perform(get("/test/header"))
      .andExpect(status().isBadRequest())
      .andExpect(jsonPath("$.error.code").value("INVALID_INPUT"));
  }

  @RestController
  static class TestController {

    @PostMapping("/test/upload")
    String upload(@RequestPart("file") MultipartFile file) {
      return "ok";
    }

    @GetMapping("/test/header")
    String header(@RequestHeader("X-Trace") String trace) {
      return "ok";
    }

    @GetMapping("/test/param")
    String param(@org.springframework.web.bind.annotation.RequestParam int n) {
      return "ok";
    }

    @GetMapping("/test/not-found")
    String notFound() {
      throw new BusinessException(ErrorCode.NOT_FOUND);
    }

    @PostMapping("/test/validate")
    String validate(@Valid @RequestBody Body body) {
      return "ok";
    }

    @GetMapping("/test/boom")
    String boom() {
      throw new RuntimeException("secret detail");
    }
  }

  record Body(@NotBlank String name) {
  }
}
