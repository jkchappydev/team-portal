package dev.jkchappy.portal.holiday;

import java.io.StringReader;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

@Component
public class PublicDataHolidayClient implements HolidayProvider {

  private final String apiKey;
  private final String endpoint;
  private final HttpClient httpClient;

  public PublicDataHolidayClient(
    @Value("${app.holiday.api-key:}") String apiKey,
    @Value("${app.holiday.endpoint:https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo}") String endpoint) {
    this.apiKey = apiKey.trim();
    this.endpoint = endpoint;
    this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
  }

  @Override
  public boolean isEnabled() {
    return !apiKey.isBlank();
  }

  @Override
  public List<HolidayData> fetch(YearMonth yearMonth) {
    if (!isEnabled()) return List.of();
    String query = "serviceKey=" + URLEncoder.encode(apiKey, StandardCharsets.UTF_8)
      + "&solYear=" + yearMonth.getYear()
      + "&solMonth=" + String.format("%02d", yearMonth.getMonthValue())
      + "&numOfRows=100";
    HttpRequest request = HttpRequest.newBuilder(URI.create(endpoint + "?" + query))
      .timeout(Duration.ofSeconds(5))
      .GET()
      .build();
    try {
      HttpResponse<String> response = httpClient.send(request,
        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      if (response.statusCode() < 200 || response.statusCode() >= 300) {
        throw new IllegalStateException("공휴일 API HTTP " + response.statusCode());
      }
      return parse(response.body());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("공휴일 API 호출이 중단되었습니다.", e);
    } catch (Exception e) {
      throw new IllegalStateException("공휴일 API 호출에 실패했습니다.", e);
    }
  }

  static List<HolidayData> parse(String xml) throws Exception {
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
    var document = factory.newDocumentBuilder().parse(new InputSource(new StringReader(xml)));
    String resultCode = text(document.getDocumentElement(), "resultCode");
    if (!"00".equals(resultCode)) {
      throw new IllegalStateException("공휴일 API 오류: " + resultCode);
    }
    NodeList items = document.getElementsByTagName("item");
    List<HolidayData> result = new ArrayList<>();
    for (int i = 0; i < items.getLength(); i++) {
      Element item = (Element) items.item(i);
      if (!"Y".equalsIgnoreCase(text(item, "isHoliday"))) continue;
      String rawDate = text(item, "locdate");
      LocalDate date = LocalDate.of(
        Integer.parseInt(rawDate.substring(0, 4)),
        Integer.parseInt(rawDate.substring(4, 6)),
        Integer.parseInt(rawDate.substring(6, 8)));
      result.add(new HolidayData(date, text(item, "dateName")));
    }
    return result.stream().distinct().toList();
  }

  private static String text(Element element, String tagName) {
    NodeList nodes = element.getElementsByTagName(tagName);
    return nodes.getLength() == 0 ? "" : nodes.item(0).getTextContent().trim();
  }
}
