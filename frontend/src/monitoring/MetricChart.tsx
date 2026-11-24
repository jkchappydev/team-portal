import { useState } from "react";
import type { PointerEvent, ReactNode } from "react";
import { Box, Paper, Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";

export interface ChartPoint {
  // 구간 시작 시각 (ms)
  t: number;
  v: number | null;
}

export interface MetricChartProps {
  title: string;
  // 제목 앞 아이콘 (선 색으로 칠함)
  icon?: ReactNode;
  // 선 색 (CSS 색 값)
  color: string;
  points: ChartPoint[];
  // 가로축 범위 (ms)
  from: number;
  to: number;
  // 점 사이 간격 (ms), 이보다 훨씬 벌어지면 기록이 없던 구간이라 선을 끊음
  bucketMs: number;
  // percent: 0~100% 고정, rate: 초당 바이트 (최댓값에 맞춰 눈금)
  kind: "percent" | "rate";
}

const HEIGHT = 200;
const MARGIN = { top: 8, right: 12, bottom: 22, left: 58 };

// 초당 바이트를 B/s·KB/s·MB/s·GB/s로
export function formatRate(bytesPerSec: number): string {
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bytesPerSec;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${unit === 0 ? Math.round(value) : value.toFixed(2)} ${units[unit]}`;
}

// 눈금용 짧은 표시 (소수점 없이)
function formatRateTick(bytesPerSec: number): string {
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  let value = bytesPerSec;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[unit]}`;
}

// 세로축 최댓값: 가장 큰 값보다 크면서 1024 단위 기준으로 4등분이 깔끔한 수 (값이 없으면 1KB/s)
export function niceRateMax(max: number): number {
  if (!(max > 0)) return 1024;
  let unit = 1;
  while (max / unit >= 1024) unit *= 1024;
  const scaled = max / unit;
  const step = [1, 2, 2.5, 5, 10, 25, 50, 100, 250].find((s) => s * 4 >= scaled) ?? 256;
  return step * 4 * unit;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TICK_STEPS = [5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY];

// 가로축 눈금: 화면 폭에 맞는 개수로, 사용자 시간대의 정각에 맞춤
export function timeTicks(from: number, to: number, maxCount: number): number[] {
  const step = TICK_STEPS.find((s) => (to - from) / s <= maxCount) ?? DAY;
  const offset = new Date(from).getTimezoneOffset() * MINUTE;
  let t = Math.ceil((from - offset) / step) * step + offset;
  const ticks: number[] = [];
  for (; t <= to; t += step) ticks.push(t);
  return ticks;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// 하루 이내는 시:분, 더 길면 월/일 (하루 단위 눈금이 아니면 시각도)
export function formatTick(t: number, spanMs: number): string {
  const d = new Date(t);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (spanMs <= DAY) return time;
  const date = `${d.getMonth() + 1}/${d.getDate()}`;
  return d.getHours() === 0 && d.getMinutes() === 0 ? date : `${date} ${time}`;
}

// 값 상자 높이와 점과의 간격 (px)
const TOOLTIP_HEIGHT = 44;
const TOOLTIP_GAP = 10;

// 값 상자가 점을 가리지 않도록: 점 위에 자리가 있으면 점 위, 없으면(값이 높을 때) 점 아래
export function tooltipTop(pointY: number): number {
  const above = pointY - TOOLTIP_HEIGHT - TOOLTIP_GAP;
  return above >= 0 ? above : pointY + TOOLTIP_GAP;
}

// 마우스를 올린 점의 시각 (월/일 시:분)
function formatFull(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 기록이 끊긴 곳(값 없음, 간격이 2.5배 이상)에서 선을 나눔
function segments(points: ChartPoint[], bucketMs: number): ChartPoint[][] {
  const result: ChartPoint[][] = [];
  let current: ChartPoint[] = [];
  let prev: ChartPoint | null = null;
  for (const p of points) {
    if (p.v === null) {
      if (current.length) result.push(current);
      current = [];
      prev = null;
      continue;
    }
    if (prev && p.t - prev.t > bucketMs * 2.5) {
      result.push(current);
      current = [];
    }
    current.push(p);
    prev = p;
  }
  if (current.length) result.push(current);
  return result;
}

// 기간 동안의 값 하나를 선으로 (마우스를 올리면 가장 가까운 점의 시각과 값)
export function MetricChart({ title, icon, color, points, from, to, bucketMs, kind }: MetricChartProps) {
  const { ref, width } = useElementSize();
  const [hover, setHover] = useState<ChartPoint | null>(null);

  const values = points.map((p) => p.v).filter((v): v is number => v !== null);
  const yMax = kind === "percent" ? 100 : niceRateMax(Math.max(0, ...values));
  const format = kind === "percent" ? (v: number) => `${v.toFixed(1)}%` : formatRate;
  const tickLabel = kind === "percent" ? (v: number) => `${v}%` : formatRateTick;

  const plotW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (t: number) => MARGIN.left + ((t - from) / (to - from)) * plotW;
  const y = (v: number) => MARGIN.top + plotH - (Math.min(v, yMax) / yMax) * plotH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => r * yMax);
  const xTicks = width > 0 ? timeTicks(from, to, Math.max(2, Math.floor(plotW / 64))) : [];
  const lines = segments(points, bucketMs);
  const latest = [...points].reverse().find((p) => p.v !== null);

  // 마우스 위치에서 가장 가까운 기록
  const onMove = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const t = from + ((event.clientX - box.left) / box.width) * (to - from);
    let best: ChartPoint | null = null;
    for (const p of points) {
      if (p.v !== null && (!best || Math.abs(p.t - t) < Math.abs(best.t - t))) best = p;
    }
    setHover(best);
  };

  const summary = latest?.v != null ? `${title} 그래프, 최근 ${format(latest.v)}` : `${title} 그래프, 기록 없음`;

  return (
    <Paper withBorder radius="md" p="md">
      <Text size="sm" fw={600} mb="xs" className="icon-text">{icon && <span className="metric-chart-icon" style={{ color }}>{icon}</span>}{title}</Text>
      <Box ref={ref} pos="relative" h={HEIGHT}>
        {width > 0 && (
          <svg width={width} height={HEIGHT} role="img" aria-label={summary} className="metric-chart">
            {yTicks.map((v) => (
              <g key={`y-${v}`}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(v)} y2={y(v)} className="metric-chart-grid" />
                <text x={MARGIN.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" className="metric-chart-label">
                  {tickLabel(v)}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <g key={`x-${t}`}>
                <line x1={x(t)} x2={x(t)} y1={MARGIN.top} y2={MARGIN.top + plotH} className="metric-chart-grid" />
                <text x={x(t)} y={HEIGHT - 6} textAnchor="middle" className="metric-chart-label">
                  {formatTick(t, to - from)}
                </text>
              </g>
            ))}
            {lines.map((line) => line.length === 1 ? (
              <circle key={line[0].t} cx={x(line[0].t)} cy={y(line[0].v!)} r={2} fill={color} />
            ) : (
              <polyline key={line[0].t} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
                points={line.map((p) => `${x(p.t)},${y(p.v!)}`).join(" ")} />
            ))}
            {hover && hover.v !== null && (
              <g pointerEvents="none">
                <line x1={x(hover.t)} x2={x(hover.t)} y1={MARGIN.top} y2={MARGIN.top + plotH} className="metric-chart-crosshair" />
                <circle cx={x(hover.t)} cy={y(hover.v)} r={4} fill={color} className="metric-chart-dot" />
              </g>
            )}
            <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="transparent"
              onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
          </svg>
        )}
        {values.length === 0 && (
          <Text size="xs" c="dimmed" className="metric-chart-empty">아직 쌓인 기록이 없습니다.</Text>
        )}
        {hover && hover.v !== null && (
          <div className="metric-chart-tooltip" style={{
            left: Math.min(Math.max(x(hover.t), MARGIN.left + 60), width - 70),
            top: tooltipTop(y(hover.v)),
          }}>
            <div className="metric-chart-tooltip-time">{formatFull(hover.t)}</div>
            <div className="metric-chart-tooltip-value">{format(hover.v)}</div>
          </div>
        )}
      </Box>
    </Paper>
  );
}
