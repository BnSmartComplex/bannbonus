export type DeviceLocality = { area: string };

export function parseDeviceLocality(value: unknown, point: { latitude: number; longitude: number }): DeviceLocality | null {
  if (!value || typeof value !== "object" || !("countryCode" in value) || value.countryCode !== "TH") return null;
  const data = value as Record<string, unknown>;
  if (typeof data.latitude !== "number" || typeof data.longitude !== "number"
      || Math.abs(data.latitude - point.latitude) >= 0.001
      || Math.abs(data.longitude - point.longitude) >= 0.001) return null;
  const parts = [data.locality, data.city, data.principalSubdivision]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .map(part => part.trim());
  const area = [...new Set(parts)].join(", ");
  return area ? { area } : null;
}
