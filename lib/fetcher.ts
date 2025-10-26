export const fetcher = async <T = unknown>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, init);
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.');
    try {
      (error as { info?: unknown }).info = await res.json();
    } catch {
      // ignore JSON parse errors and fall back to status text
      (error as { info?: unknown }).info = res.statusText;
    }
    (error as { status?: number }).status = res.status;
    throw error;
  }
  return res.json() as Promise<T>;
};
