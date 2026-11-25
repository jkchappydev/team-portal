// 사용률 칸: 테두리 상자 안에 왼쪽 이름·오른쪽 퍼센트, 아래 얇은 막대 (값이 바뀌면 막대가 부드럽게 늘고 줄어듦)
// 막대는 평소 파랑, 높아지면 주황·빨강으로 바꿔 여유가 없는 자원을 바로 알아보게 함

// 이 값 이상이면 주의(주황), 위험(빨강)
const WARN_PERCENT = 80;
const DANGER_PERCENT = 90;

export interface ServerGaugeProps {
  label: string;
  // 측정 전이면 null (막대는 비우고 숫자는 -)
  percent: number | null;
  // 막대 아래 작은 설명 (예: 7.4GB / 15.4GB)
  detail?: string;
}

export function gaugeLevel(percent: number | null): "normal" | "warn" | "danger" {
  if (percent === null || percent < WARN_PERCENT) return "normal";
  return percent < DANGER_PERCENT ? "warn" : "danger";
}

export function ServerGauge({ label, percent, detail }: ServerGaugeProps) {
  const value = percent === null ? 0 : Math.max(0, Math.min(100, percent));

  return (
    <div className="server-gauge">
      <div className="server-gauge-head">
        <span className="server-gauge-label">{label}</span>
        <span className="server-gauge-value">{percent === null ? "-" : `${Math.round(value)}%`}</span>
      </div>
      <div
        className="server-gauge-track"
        role="meter"
        aria-label={`${label} 사용률`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent === null ? undefined : Math.round(value)}
      >
        <div className="server-gauge-bar" data-level={gaugeLevel(percent)} style={{ width: `${value}%` }} />
      </div>
      {detail && <div className="server-gauge-detail">{detail}</div>}
    </div>
  );
}
