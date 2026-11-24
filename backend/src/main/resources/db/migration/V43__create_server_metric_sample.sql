-- 모니터링 사용 기록: 서버별 1분마다 CPU·메모리 사용률과 네트워크 초당 전송량 (7일 지난 기록은 지움)
CREATE TABLE server_metric_sample (
  id BIGSERIAL PRIMARY KEY,
  server_name VARCHAR(200) NOT NULL,
  sampled_at TIMESTAMPTZ NOT NULL,
  cpu_percent DOUBLE PRECISION,
  memory_percent DOUBLE PRECISION,
  rx_bytes_per_sec DOUBLE PRECISION,
  tx_bytes_per_sec DOUBLE PRECISION
);

CREATE INDEX idx_server_metric_sample_server_time ON server_metric_sample (server_name, sampled_at);
CREATE INDEX idx_server_metric_sample_time ON server_metric_sample (sampled_at);
