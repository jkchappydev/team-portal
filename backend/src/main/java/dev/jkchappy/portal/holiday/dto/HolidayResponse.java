package dev.jkchappy.portal.holiday.dto;

import dev.jkchappy.portal.holiday.Holiday;
import java.time.LocalDate;

public record HolidayResponse(LocalDate date, String name) {

  public static HolidayResponse from(Holiday holiday) {
    return new HolidayResponse(holiday.getHolidayDate(), holiday.getName());
  }
}
