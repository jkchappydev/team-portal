package dev.jkchappy.portal.holiday;

import java.time.YearMonth;
import java.util.List;

public interface HolidayProvider {

  boolean isEnabled();

  List<HolidayData> fetch(YearMonth yearMonth);
}
