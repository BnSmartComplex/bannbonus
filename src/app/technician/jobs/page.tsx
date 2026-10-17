"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Job = { id: string; scheduled_start: string; scheduled_end: string; price_baht: number; status: string };
export default function TechnicianJobsPage() {
  const supabase = getSupabase();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    if (!supabase) return;
    const { data, error } = await supabase.from("booking_appointments").select("*").order("scheduled_start");
    if (error) setMessage(error.message); else setJobs(data ?? []);
  }
  useEffect(() => { void load(); }, [supabase]);
  async function update(id: string, status: string) {
    if (!supabase) return;
    const { error } = await supabase.rpc("technician_update_appointment_status", { p_appointment_id: id, p_status: status });
    setMessage(error?.message ?? "อัปเดตสถานะแล้ว"); if (!error) void load();
  }
  return <section><h1>Technician · Jobs</h1><p role="status">{message}</p>
    {jobs.map((job) => <article className="card" key={job.id}>
      <p>{new Date(job.scheduled_start).toLocaleString("th-TH")} – {new Date(job.scheduled_end).toLocaleString("th-TH")}</p>
      <p>ราคาอ้างอิง: {job.price_baht} บาท · {job.status}</p>
      {job.status === "ASSIGNED" && <button className="btn" onClick={() => void update(job.id, "ACCEPTED")}>รับงาน</button>}
      {job.status === "ACCEPTED" && <button className="btn" onClick={() => void update(job.id, "IN_PROGRESS")}>เริ่มงาน</button>}
      {job.status === "IN_PROGRESS" && <button className="btn" onClick={() => void update(job.id, "COMPLETED")}>เสร็จงาน</button>}
    </article>)}
  </section>;
}
