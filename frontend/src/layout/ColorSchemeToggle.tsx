import { SegmentedControl, type MantineColorScheme } from "@mantine/core";

const OPTIONS: { label: string; value: MantineColorScheme }[] = [
  { label: "라이트", value: "light" },
  { label: "다크", value: "dark" },
  { label: "시스템", value: "auto" },
];

interface Props {
  value: MantineColorScheme;
  onChange: (value: MantineColorScheme) => void;
}

// 화면 테마 고르기 버튼 묶음 (고른 값은 부모가 저장할 때 적용)
export function ColorSchemeToggle({ value, onChange }: Props) {
  return (
    <SegmentedControl
      size="xs"
      aria-label="화면 테마"
      data={OPTIONS}
      value={value}
      onChange={(next) => onChange(next as MantineColorScheme)}
    />
  );
}
