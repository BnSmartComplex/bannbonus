"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { validateSchedule, type ScheduleDraft } from "@/lib/schedule";

type Booking = {
  id: string;
  tenant_id: string;
  category: string;
  area: string;
  status: string;
  created_at: string;
};
type Technician = { user_id: string };

const emptyDraft: ScheduleDraft = { date: "", startTime: "", endTime: "" };

export default function OperatorBookingsPage() {
  const supabase = getSupabase();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [techniciansByTenant, setTechniciansByTenant] = useState<Record<string, Technician[]>>({});
  const [selectedTechnician, setSelectedTechnician] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabase) return;
    void (async () => {
      const { data, error } = await supabase
        .from("booking_requests")
        .select("id,tenant_id,category,area,status,created_at")
        .eq("status", "PENDING_TEAM_REVIEW")
        .order("created_at");
      if (error) {
        setMessage("โหลดคำขอไม่สำเร็จ");
        return;
      }

      const tenantIds = [...new Set((data ?? []).map((booking) => booking.tenant_id))];
      const directoryResults = await Promise.all(
        tenantIds.map(async (tenantId) => {
          const result = await supabase.rpc("list_tenant_technicians", { p_tenant_id: tenantId });
          return [tenantId, result] as const;
        }),
      );
      const directory: Record<string, Technician[]> = {};
      for (const [tenantId, result] of directoryResults) {
        if (result.error) {
          setMessage(result.error.message);
          return;
        }
        directory[tenantId] = (result.data ?? []) as Technician[];
      }
      setBookings((data ?? []) as Booking[]);
      setTechniciansByTenant(directory);
    })();
  }, [supabase]);

  function updateDraft(bookingId: string, key: keyof ScheduleDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [bookingId]: { ...(current[bookingId] ?? emptyDraft), [key]: value },
    }));
  }

  async function approve(booking: Booking) {
    if (!supabase) return;
    const technicianId = selectedTechnician[booking.id];
    const draft = drafts[booking.id] ?? emptyDraft;
    if (!technicianId) {
      setMessage("กรุณาเลือกช่าง");
      return;
    }
    const schedule = validateSchedule(draft);
    if (!schedule.ok) {
      setMessage(schedule.message);
      return;
    }

    setMessage("กำลังตรวจสอบสิทธิ์และเวลาว่างจาก backend…");
    const { error } = await supabase.rpc("approve_booking_and_assign_technician", {
      p_booking_id: booking.id,
      p_technician_id: technicianId,
      p_scheduled_start: schedule.startIso,
      p_scheduled_end: schedule.endIso,
    });
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage("อนุมัติและมอบหมายงานสำเร็จ");
    setBookings((current) => current.filter((item) => item.id !== booking.id));
  }

  return (
    <section>
      <h1>Operator · Booking Approval</h1>
      <p role="status">{message}</p>
      {bookings.map((booking) => {
        const draft = drafts[booking.id] ?? emptyDraft;
        const technicians = techniciansByTenant[booking.tenant_id] ?? [];
        const technicianId = "technician-" + booking.id;
        const dateId = "date-" + booking.id;
        const startId = "start-" + booking.id;
        const endId = "end-" + booking.id;
        return (
          <article className="card" key={booking.id}>
            <strong>{booking.category}</strong> · {booking.area} · {booking.status}
            <p>{booking.id}</p>
            <form onSubmit={(event) => { event.preventDefault(); void approve(booking); }}>
              <label htmlFor={technicianId}>ช่างใน tenant นี้</label>
              <select
                id={technicianId}
                required
                value={selectedTechnician[booking.id] ?? ""}
                onChange={(event) => setSelectedTechnician((current) => ({
                  ...current, [booking.id]: event.target.value,
                }))}
              >
                <option value="">เลือกช่าง</option>
                {technicians.map((technician) => (
                  <option key={technician.user_id} value={technician.user_id}>{technician.user_id}</option>
                ))}
              </select>
              <label htmlFor={dateId}>วันที่นัดหมาย (Asia/Bangkok)</label>
              <input
                id={dateId}
                type="date"
                required
                value={draft.date}
                onChange={(event) => updateDraft(booking.id, "date", event.target.value)}
              />
              <label htmlFor={startId}>เวลาเริ่ม (Asia/Bangkok, UTC+07:00)</label>
              <input
                id={startId}
                type="time"
                required
                value={draft.startTime}
                onChange={(event) => updateDraft(booking.id, "startTime", event.target.value)}
              />
              <label htmlFor={endId}>เวลาสิ้นสุด (Asia/Bangkok, UTC+07:00)</label>
              <input
                id={endId}
                type="time"
                required
                value={draft.endTime}
                onChange={(event) => updateDraft(booking.id, "endTime", event.target.value)}
              />
              <small>ระบบจะส่งเวลาเป็น UTC ให้ backend หลังตรวจสอบวันเวลาตาม Asia/Bangkok</small>
              <p><button className="btn" type="submit">อนุมัติและมอบหมาย</button></p>
            </form>
          </article>
        );
      })}
    </section>
  );
}
