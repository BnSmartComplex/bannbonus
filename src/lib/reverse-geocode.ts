export type AddressSuggestion = { address: string; level: "STREET" | "AREA"; source: "OPENROUTESERVICE_OSM" };

export function parseReverseGeocode(value: unknown): AddressSuggestion | null {
  if (!value || typeof value !== "object" || !("features" in value) || !Array.isArray(value.features)) return null;
  for (const feature of value.features) {
    const properties = feature?.properties;
    if (!properties || typeof properties !== "object") continue;
    const address = typeof properties.label === "string" ? properties.label.trim() : "";
    if (!address || address.length > 600) continue;
    const level = ["address", "venue", "street"].includes(properties.layer) ? "STREET" : "AREA";
    return { address, level, source: "OPENROUTESERVICE_OSM" };
  }
  return null;
}
