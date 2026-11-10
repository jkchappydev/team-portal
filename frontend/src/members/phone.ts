// 전화번호 입력을 숫자만 남겨 하이픈 위치에 맞춰 바꿈 (서버 MemberService.hyphenatePhone과 같은 규칙)
// 입력하는 도중에도 자리에 맞게 하이픈을 넣고, 최대 11자리까지만 받음
export function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 11);
  const n = digits.length;
  // 서울 02: 02-123-4567 / 02-1234-5678
  if (digits.startsWith("02")) {
    if (n <= 2) return digits;
    if (n <= 5) return `02-${digits.slice(2)}`;
    if (n <= 9) return `02-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `02-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  // 대표번호 1588-1234
  if (!digits.startsWith("0") && n > 4) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`;
  }
  // 휴대폰·지역번호: 010-1234-5678 / 031-123-4567
  if (n <= 3) return digits;
  if (n <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (n <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

// 내선번호는 숫자 3자리까지
export function formatExtension(input: string): string {
  return input.replace(/\D/g, "").slice(0, 3);
}
