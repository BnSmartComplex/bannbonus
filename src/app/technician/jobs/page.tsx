"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { DispatchEligibility, PresenceStatus } from "@/modules/dispatch";

type Job = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  estimated_dispatch_fee_baht: number;
  payment_status: "NOT_CHARGED";
  status: string;
};

type Membership = { tenant_id: string };

const reasonLabels: Record<string, string> = {
  OFFLINE: "ช่างตั้งเป็น OFFLINE",
  PRESENCE_STALE: "สถานะออนไลน์หมดอายุ ต้องส่ง heartbeat ใหม่",
  ACTIVE_VISIT: "มีงานที่กำลังเช็กอินอยู่",
  ACTIVE_ASSIGNMENT: "มีงานที่กำลังดำเนินการในช่วงเวลานี้",
  SCHEDULE_CONFLICT: "มีการจองเวลาซ้อนกัน",
  SKILL_MISMATCH: "ไม่ตรงกับทักษะที่ร้องขอ",
  AREA_MISMATCH: "ไม่ครอบคลุมพื้นที่ที่ร้องขอ",
  SKILL_AREA_MISMATCH: "ไม่มีชุดทักษะและพื้นที่ที่ตรงกับงานนี้",
};

export default function TechnicianJobsPage() {
  const supabase = getSupabase();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [presence, setPresence] = useState<PresenceStatus>("OFFLINE");
  const [eligibility, setEligibility] = useState<DispatchEligibility | null>(null);
  const [tenantId, setTenantId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!supabase) return;
    const { data: memberships, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("role", "technician")
      .limit(1);
    const membership = (memberships?.[0] ?? null) as Membership | null;
    if (membershipError || !membership) {
      setMessage(membershipError?.message ?? "ไม่พบ tenant ของช่าง");
      return;
    }
    setTenantId(membership.tenant_id);
    const [jobsResult, eligibilityResult] = await Promise.all([
      supabase.from("booking_appointments")
        .select("id,scheduled_start,scheduled_end,estimated_dispatch_fee_baht,payment_status,status")
        .order("scheduled_start"),
      supabase.rpc("get_technician_dispatch_eligibility", {
        p_tenant_id: membership.tenant_id,
        p_technician_id: (await supabase.auth.getUser()).data.user?.id,
        p_service_area: "BANGKOK",
        p_skill: "OTHER",
        p_scheduled_start: new Date(Date.now() + 60_000).toISOString(),
        p_scheduled_end: new Date(Date.now() + 3_660_000).toISOString(),
      }),
    ]);
    if (jobsResult.error) setMessage(jobsResult.error.message);
    else setJobs((jobsResult.data ?? []) as Job[]);
    if (eligibilityResult.error) setMessage(eligibilityResult.error.message);
    else {
      const row = (eligibilityResult.data?.[0] ?? null) as DispatchEligibility | null;
      setEligibility(row);
      if (row?.presence_status) setPresence(row.presence_status);
    }
  }

  useEffect(() => { void load(); }, [supabase]);

  useEffect(() => {
    if (!supabase || !tenantId || presence !== "ONLINE") return;
    let active = true;
    const heartbeat = async () => {
      if (document.visibilityState !== "visible") return;
      const { error } = await supabase.rpc("set_technician_presence", {
        p_tenant_id: tenantId,
        p_presence_status: "ONLINE",
      });
      if (!active) return;
      if (error) {
        setEligibility(null);
        setMessage("ต่ออายุสถานะ ONLINE ไม่สำเร็จ: " + error.message);
      } else {
        void load();
      }
    };
    const timer = window.setInterval(() => { void heartbeat(); }, 2 * 60 * 1000);
    const onVisibility = () => { if (document.visibilityState === "visible") void heartbeat(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [supabase, tenantId, presence]);

  async function setTechnicianPresence(next: PresenceStatus) {
    if (!supabase || !tenantId) return;
    const { error } = await supabase.rpc("set_technician_presence", {
      p_tenant_id: tenantId,
      p_presence_status: next,
    });
    setMessage(error?.message ?? `เปลี่ยนสถานะเป็น ${next} แล้ว`);
    if (!error) void load();
  }

  async function update(id: string, status: string) {
    if (!supabase) return;
    const { error } = status === "IN_PROGRESS"
      ? await supabase.rpc("technician_check_in", { p_appointment_id: id })
      : status === "COMPLETED"
        ? await supabase.rpc("technician_check_out", { p_appointment_id: id })
        : await supabase.rpc("technician_update_appointment_status", {
          p_appointment_id: id,
          p_status: status,
        });
    setMessage(error?.message ?? "อัปเดตสถานะแล้ว");
    if (!error) void load();
  }

  return (
    <section>
      <h1>Technician · Jobs</h1>
      <p role="status">{message}</p>
      <article className="card" aria-live="polite">
        <strong>สถานะช่างจาก Backend</strong>
        <p>Presence: {presence} · Availability: {eligibility?.is_available ? "AVAILABLE" : "UNAVAILABLE"}</p>
        <p>{eligibility?.reasons?.length
          ? eligibility.reasons.map((reason) => reasonLabels[reason] ?? reason).join(" · ")
          : "ไม่มี blocker ตามเงื่อนไขทดสอบพื้นที่ Bangkok และ skill OTHER"}</p>
        <button className="btn" onClick={() => void setTechnicianPresence("ONLINE")}>ตั้งเป็น ONLINE</button>{" "}
        <button className="btn" onClick={() => void setTechnicianPresence("OFFLINE")}>ตั้งเป็น OFFLINE</button>
        <small className="muted">ONLINE ไม่ได้แปลว่า AVAILABLE; ระบบจะคำนวณจาก presence freshness, visit, งานซ้อน, skill และพื้นที่</small>
      </article>
      {jobs.map((job) => (
        <article className="card" key={job.id}>
          <p>{new Date(job.scheduled_start).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} – {new Date(job.scheduled_end).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          <p>ค่าบริการออกตรวจ: รอตรวจระยะทางตามถนนจากสำนักงานและเวลาที่ออกเดินทางจริง · ยังไม่เรียกเก็บเงิน · {job.status}</p>
          {job.status === "ASSIGNED" && <button className="btn" onClick={() => void update(job.id, "ACCEPTED")}>รับงาน</button>}
          {job.status === "ACCEPTED" && <button className="btn" onClick={() => void update(job.id, "IN_PROGRESS")}>เริ่มงาน</button>}
          {job.status === "IN_PROGRESS" && <button className="btn" onClick={() => void update(job.id, "COMPLETED")}>เสร็จงาน</button>}
          {["ASSIGNED", "ACCEPTED"].includes(job.status) && (
            <button className="btn" onClick={() => void update(job.id, "CANCELLED")}>ยกเลิกงาน</button>
          )}
        </article>
      ))}
    </section>
  );
}
