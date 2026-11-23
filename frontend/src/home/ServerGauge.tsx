// 계기판 모양 사용률 표시: 5칸 색 반원(왼쪽 초록 0% ~ 오른쪽 빨강 100%)과 검은 바늘, 아래 숫자와 이름
// 바늘은 0%일 때 왼쪽, 100%일 때 오른쪽 (값이 바뀌면 부드럽게 움직임)

const CENTER_X = 60;
const CENTER_Y = 60;
const OUTER_RADIUS = 54;
const INNER_RADIUS = 32;
// 칸 사이 흰 틈 (도)
const GAP_DEGREES = 2;

// 사용률이 낮을수록 초록, 높을수록 빨강
const SEGMENT_COLORS = ["#2dbb3a", "#a6d127", "#ffd60a", "#f8a531", "#f2311b"];

// 0도(왼쪽)~180도(오른쪽) 위치의 반원 위 좌표
function pointAt(degrees: number, radius: number): [number, number] {
  const angle = (Math.PI * (180 - degrees)) / 180;
  return [CENTER_X + radius * Math.cos(angle), CENTER_Y - radius * Math.sin(angle)];
}

// from~to(도) 사이 도넛 조각
function segmentPath(from: number, to: number): string {
  const [ox1, oy1] = pointAt(from, OUTER_RADIUS);
  const [ox2, oy2] = pointAt(to, OUTER_RADIUS);
  const [ix2, iy2] = pointAt(to, INNER_RADIUS);
  const [ix1, iy1] = pointAt(from, INNER_RADIUS);
  return `M ${ox1} ${oy1} A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 0 1 ${ox2} ${oy2} `
    + `L ${ix2} ${iy2} A ${INNER_RADIUS} ${INNER_RADIUS} 0 0 0 ${ix1} ${iy1} Z`;
}

const SEGMENTS = SEGMENT_COLORS.map((color, i) => {
  const size = 180 / SEGMENT_COLORS.length;
  const from = i * size + (i === 0 ? 0 : GAP_DEGREES / 2);
  const to = (i + 1) * size - (i === SEGMENT_COLORS.length - 1 ? 0 : GAP_DEGREES / 2);
  return { color, d: segmentPath(from, to) };
});

export interface ServerGaugeProps {
  label: string;
  // 측정 전이면 null (바늘은 0, 숫자는 -)
  percent: number | null;
  // 계기판 아래 작은 설명 (예: 7.4GB / 15.4GB)
  detail?: string;
}

export function ServerGauge({ label, percent, detail }: ServerGaugeProps) {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div className="server-gauge">
      <svg
        viewBox="0 0 120 68"
        role="meter"
        aria-label={`${label} 사용률`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.round(value)}
      >
        {SEGMENTS.map((segment) => <path key={segment.color} d={segment.d} fill={segment.color} />)}
        {/* 바늘: 왼쪽을 향해 그린 뒤 사용률만큼 시계 방향으로 돌림 */}
        <g className="server-gauge-needle" style={{ transform: `rotate(${value * 1.8}deg)`, transformOrigin: `${CENTER_X}px ${CENTER_Y}px` }}>
          <polygon points={`${CENTER_X - 44},${CENTER_Y} ${CENTER_X},${CENTER_Y - 3.2} ${CENTER_X},${CENTER_Y + 3.2}`} fill="#111111" />
        </g>
        <circle cx={CENTER_X} cy={CENTER_Y} r="5.5" fill="#111111" />
        <circle cx={CENTER_X} cy={CENTER_Y} r="2" fill="#ffffff" />
      </svg>
      <div className="server-gauge-value">{percent === null ? "-" : `${Math.round(value)}%`}</div>
      <div className="server-gauge-label">{label}</div>
      {detail && <div className="server-gauge-detail">{detail}</div>}
    </div>
  );
}
