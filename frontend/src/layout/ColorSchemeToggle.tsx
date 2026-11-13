import { Select, type MantineColorScheme } from "@mantine/core";

const OPTIONS: { label: string; value: MantineColorScheme }[] = [
  { label: "라이트", value: "light" },
  { label: "다크", value: "dark" },
  { label: "시스템", value: "auto" },
];

interface Props {
  value: MantineColorScheme;
  onChange: (value: MantineColorScheme) => void;
}

// 화면 테마 선택 칸 (고른 값은 부모가 저장할 때 적용)
export function ColorSchemeToggle({ value, onChange }: Props) {
  return (
    <Select
      size="sm"
      w={160}
      aria-label="화면 테마"
      data={OPTIONS}
      value={value}
      allowDeselect={false}
      onChange={(next) => { if (next) onChange(next as MantineColorScheme); }}
    />
  );
}
