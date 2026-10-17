"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Booking = { id: string; category: string; area: string; status: string; created_at: string };
type Technician = { user_id: string };

export default function OperatorBookingsPage() {
  const supabase = getSupabase();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!supabase) return;
    void Promise.all([
      supabase.from("booking_requests").select("id,category,area,status,created_at").eq("status", "PENDING_TEAM_REVIEW").order("created_at"),
      supabase.from("tenant_memberships").select("user_id").eq("role", "technician"),
    ]).then(([b, t]) => {
      if (b.error || t.error) setMessage("โหลดข้อมูลไม่สำเร็จ");
      else { setBookings(b.data ?? []); setTechnicians(t.data ?? []); }
    });
  }, [supabase]);
  async function approve(booking: Booking, technicianId: string) {
    if (!supabase) return;
    const start = window.prompt("เวลาเริ่ม ISO เช่น 2026-10-17T14:00:00Z");
    const end = window.prompt("เวลาสิ้นสุด ISO เช่น 2026-10-17T15:00:00Z");
    if (!start || !end) return;
    setMessage("กำลังตรวจสอบสิทธิ์และเวลาว่างจาก backend…");
    const { error } = await supabase.rpc("approve_booking_and_assign_technician", {
      p_booking_id: booking.id, p_technician_id: technicianId,
      p_scheduled_start: start, p_scheduled_end: end,
    });
    if (error) setMessage(error.message);
    else { setMessage("อนุมัติและมอบหมายงานสำเร็จ"); setBookings((current) => current.filter((x) => x.id !== booking.id)); }
  }
  return <section><h1>Operator · Booking Approval</h1><p role="status">{message}</p>
    {bookings.map((booking) => <article className="card" key={booking.id}>
      <strong>{booking.category}</strong> · {booking.area} · {booking.status}<p>{booking.id}</p>
      {technicians.map((tech) => <button className="btn" key={tech.user_id} onClick={() => void approve(booking, tech.user_id)}>มอบหมาย {tech.user_id.slice(0, 8)}</button>)}
    </article>)}
  </section>;
}
