import type { RoadGeometry } from "@/components/customer-road-map";

export type RoadStep = {
  instructionTh: string;
  roadName: string | null;
  distanceMeters: number;
};
export type RoadData = {
  distanceMeters: number;
  durationSeconds: number;
  geometry: RoadGeometry;
  roadSteps: RoadStep[];
};

function thaiInstruction(turn: number, roadName: string | null): string {
  const movement: Record<number,string> = {
    0:"เลี้ยวซ้าย",1:"เลี้ยวขวา",2:"เลี้ยวซ้ายหักศอก",3:"เลี้ยวขวาหักศอก",
    4:"เบี่ยงซ้าย",5:"เบี่ยงขวา",6:"ตรงไป",7:"เข้าวงเวียน",8:"ออกจากวงเวียน",
    9:"กลับรถ",10:"ถึงจุดหมาย",11:"ออกจากจุดเริ่มต้น",12:"ชิดซ้าย",13:"ชิดขวา",
  };
  const action = movement[turn] ?? "ขับตามเส้นทาง";
  return roadName ? `${action} เข้าสู่ ${roadName}` : action;
}

export function parseOpenRouteServiceGeoJson(raw: unknown): RoadData | null {
  if (!raw || typeof raw !== "object") return null;
  const features = (raw as {features?: unknown}).features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const feature = features[0] as {geometry?: unknown;properties?: unknown};
  if (!feature || typeof feature !== "object") return null;
  const geo = feature.geometry as {type?: unknown;coordinates?: unknown}|undefined;
  const properties = feature.properties as {summary?: unknown;segments?: unknown}|undefined;
  const summary = properties?.summary as {distance?: unknown;duration?: unknown}|undefined;
  const coordinates = geo?.coordinates;
  if (geo?.type !== "LineString" || !Array.isArray(coordinates) || coordinates.length < 2 ||
      coordinates.length > 15_000) return null;
  if (typeof summary?.distance !== "number" || typeof summary.duration !== "number"
      || !Number.isFinite(summary.distance) || summary.distance <= 0 || summary.distance > 600_000
      || !Number.isFinite(summary.duration) || summary.duration < 0 || summary.duration > 172_800) return null;
  const points: [number,number][] = [];
  for (const p of coordinates) {
    if (!Array.isArray(p) || p.length < 2 ||
        typeof p[0] !== "number" || typeof p[1] !== "number" ||
        !Number.isFinite(p[0]) || !Number.isFinite(p[1]) ||
        p[0] < 97 || p[0] > 106 || p[1] < 5 || p[1] > 21) return null;
    points.push([p[0],p[1]]);
  }
  const roadSteps: RoadStep[] = [];
  if (Array.isArray(properties?.segments)) {
    for (const segment of properties.segments as Array<{steps?: unknown}>) {
      if (!Array.isArray(segment?.steps)) continue;
      for (const step of segment.steps) {
        const val = step as {name?:unknown;type?:unknown;distance?:unknown};
        if (roadSteps.length >= 80) break;
        const name = typeof val.name === "string" && val.name.trim() && val.name !== "-"
          ? val.name.trim().slice(0,120) : null;
        const type = typeof val.type === "number" && Number.isSafeInteger(val.type) ? val.type : 6;
        const distance = typeof val.distance === "number" && val.distance >= 0 && Number.isFinite(val.distance)
          ? Math.round(val.distance) : 0;
        roadSteps.push({instructionTh:thaiInstruction(type,name),roadName:name,distanceMeters:distance});
      }
    }
  }
  return {distanceMeters:Math.round(summary.distance),durationSeconds:summary.duration,
    geometry:{type:"LineString",coordinates:points},roadSteps};
}
