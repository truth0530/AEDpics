interface PerformanceSample {
  name: string;
  durationMs: number;
  thresholdMs?: number;
  metadata?: Record<string, unknown>;
}

export function reportSlowOperation(sample: PerformanceSample) {
  const threshold = sample.thresholdMs ?? 2000;
  if (sample.durationMs <= threshold) {
    return;
  }

  const payload = {
    durationMs: sample.durationMs,
    thresholdMs: threshold,
    ...(sample.metadata ?? {}),
  };

  console.warn(`[Performance] Slow operation detected: ${sample.name}`, payload);
}
