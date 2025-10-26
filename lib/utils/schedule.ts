export function buildScheduledTimestamp(date: string, time?: string | null): string | null {
  try {
    if (!date) return null;
    const sanitizedTime = (time && time.trim().length > 0) ? time : '09:00';
    const dateTime = new Date(`${date}T${sanitizedTime}`);
    if (Number.isNaN(dateTime.getTime())) {
      return null;
    }
    return dateTime.toISOString();
  } catch {
    return null;
  }
}

export function isValidAssigneeIdentifier(value: string): boolean {
  if (!value) return false;
  const normalized = value.trim();
  if (normalized.length < 3) return false;
  if (normalized.includes('@')) {
    // Basic email heuristic
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  }
  // Allow UUID-like strings or other identifiers of reasonable length
  return normalized.length >= 5;
}
