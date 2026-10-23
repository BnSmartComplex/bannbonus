"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type BookingItem = {
  id: string;
  category: string;
  fault_description: string;
  status: string;
  contact_name: string;
  contact_phone: string;
};

export default function StaffPage() {
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [message, setMessage] = useState("กำลังตรวจสอบสิทธิ์");

  useEffect(() => {
    let active = true;
    void (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        if (active) setMessage("ยังไม่ได้ตั้งค่า Supabase สำหรับสภาพแวดล้อมนี้");
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (active) setMessage("กรุณาเข้าสู่ระบบด้วยบัญชีทีมงาน");
        return;
      }
      const { data, error } = await supabase
        .from("booking_requests")
        .select("id,category,fault_description,status,contact_name,contact_phone")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setMessage("โหลดรายการไม่สำเร็จ หรือบัญชีนี้ไม่มีสิทธิ์ดูข้อมูลทีมงาน");
        return;
      }
      setRows(data ?? []);
      setMessage(data?.length ? "" : "ไม่มีคำขอที่ได้รับอนุญาต");
    })();
    return () => { active = false; };
  }, []);

  return (
    <section>
      <h1>ศูนย์รับคำขอทีมงาน</h1>
      <div className="notice">
        รายการคำขอนี้เป็นมุมมองอ่านอย่างเดียว การอนุมัติ Booking และสถานะงานช่างดำเนินการผ่านหน้าที่มีสิทธิ์เฉพาะ
      </div>
      <p><Link className="btn" href="/operator/bookings">อนุมัติ Booking</Link></p>
      <p aria-live="polite">{message}</p>
      {rows.map((item) => (
        <article className="card" key={item.id}>
          <strong>{item.status} · {item.category}</strong>
          <p>{item.fault_description}</p>
          <p>{item.contact_name} · {item.contact_phone}</p>
          <small className="muted">{item.id}</small>
        </article>
      ))}
    </section>
  );
}
