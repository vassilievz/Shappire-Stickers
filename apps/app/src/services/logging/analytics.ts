/** No-op analytics — app offline-first, sem telemetria remota. */
export async function logAnalyticsEvent(
  _name: string,
  _params?: Record<string, string | number | boolean>,
): Promise<void> {
  /* intentionally empty */
}
