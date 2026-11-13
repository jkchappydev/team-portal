import { Select, useMantineColorScheme, type MantineColorScheme } from "@mantine/core";

const OPTIONS: { label: string; value: MantineColorScheme }[] = [
  { label: "라이트", value: "light" },
  { label: "다크", value: "dark" },
  { label: "시스템", value: "auto" },
];

// 화면 테마 선택 (이 브라우저에 저장되어 바로 적용)
export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <Select
      size="sm"
      w={160}
      aria-label="화면 테마"
      data={OPTIONS}
      value={colorScheme}
      allowDeselect={false}
      onChange={(value) => { if (value) setColorScheme(value as MantineColorScheme); }}
    />
  );
}
