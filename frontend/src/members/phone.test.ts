import { describe, expect, it } from "vitest";
import { formatExtension, formatPhone } from "./phone";

describe("formatPhone", () => {
  it("숫자만 입력해도 하이픈을 넣는다", () => {
    expect(formatPhone("01000000000")).toBe("010-0000-0000");
    expect(formatPhone("0212345678")).toBe("02-1234-5678");
    expect(formatPhone("021234567")).toBe("02-123-4567");
    expect(formatPhone("0311234567")).toBe("031-123-4567");
    expect(formatPhone("15881234")).toBe("1588-1234");
  });

  it("입력 중에도 자리에 맞게 바꾸고 숫자 외 문자와 11자리 초과는 버린다", () => {
    expect(formatPhone("010")).toBe("010");
    expect(formatPhone("0103")).toBe("010-3");
    expect(formatPhone("0100000")).toBe("010-000-0");
    expect(formatPhone("010-0000-00001")).toBe("010-0000-0000");
    expect(formatPhone("010 abc 0000")).toBe("010-000-0");
  });
});

describe("formatExtension", () => {
  it("숫자 3자리까지만 남긴다", () => {
    expect(formatExtension("3861")).toBe("386");
    expect(formatExtension("3a8")).toBe("38");
  });
});
