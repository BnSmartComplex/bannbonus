export const BANGKOK_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_OFFSET_MINUTES = 7 * 60;

export type ScheduleDraft = {
  date: string;
  startTime: string;
  endTime: string;
};

export type ScheduleValidation =
  | { ok: true; startIso: string; endIso: string }
  | { ok: false; message: string };

function parseWallClock(value: string, label: string, time?: string): Date | ScheduleValidation {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return { ok: false, message: label + "ไม่ถูกต้อง" };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timeMatch = time ? /^(\d{2}):(\d{2})$/.exec(time) : null;
  if (time && !timeMatch) return { ok: false, message: "เวลาต้องเป็น HH:mm" };
  const hour = timeMatch ? Number(timeMatch[1]) : 0;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;
  if (hour > 23 || minute > 59) return { ok: false, message: "เวลาต้องเป็น HH:mm ที่ถูกต้อง" };

  const result = new Date(
    Date.UTC(year, month - 1, day, hour, minute) - BANGKOK_OFFSET_MINUTES * 60_000,
  );
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" as const } : {}),
  }).formatToParts(result);
  const actual = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
  );
  if (
    actual.year !== match[1]
    || actual.month !== match[2]
    || actual.day !== match[3]
    || (time && (
      actual.hour !== timeMatch?.[1] || actual.minute !== timeMatch?.[2]
    ))
  ) {
    return { ok: false, message: "วันเวลานี้ไม่ถูกต้องใน Asia/Bangkok" };
  }
  return result;
}

export function validateSchedule(
  draft: ScheduleDraft,
  now = new Date(),
): ScheduleValidation {
  const start = parseWallClock(draft.date, "วันที่");
  if (!(start instanceof Date)) return start;
  const startWithTime = parseWallClock(draft.date, "วันเวลา", draft.startTime);
  if (!(startWithTime instanceof Date)) return startWithTime;
  const end = parseWallClock(draft.date, "วันเวลา", draft.endTime);
  if (!(end instanceof Date)) return end;
  if (startWithTime <= now) return { ok: false, message: "เวลาเริ่มต้องอยู่ในอนาคต" };
  if (end <= startWithTime) return { ok: false, message: "เวลาสิ้นสุดต้องหลังเวลาเริ่ม" };
  return { ok: true, startIso: startWithTime.toISOString(), endIso: end.toISOString() };
}
