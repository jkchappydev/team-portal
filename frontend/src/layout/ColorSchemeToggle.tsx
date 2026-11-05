import { SegmentedControl, useMantineColorScheme, type MantineColorScheme } from "@mantine/core";

const OPTIONS: { label: string; value: MantineColorScheme }[] = [
  { label: "라이트", value: "light" },
  { label: "다크", value: "dark" },
  { label: "시스템", value: "auto" },
];

export function ColorSchemeToggle() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();

  return (
    <SegmentedControl
      size="xs"
      fullWidth
      aria-label="화면 테마"
      data={OPTIONS}
      value={colorScheme}
      onChange={(value) => setColorScheme(value as MantineColorScheme)}
    />
  );
}
