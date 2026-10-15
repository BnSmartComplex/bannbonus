"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type BookingItem = {
  id: string;
  category: string;
  fault_description: string;
  status: string;
  created_at: string;
};

export default function MyBookingsPage() {
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [message, setMessage] = useState("กำลังโหลดรายการ");

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
        if (active) setMessage("กรุณาเข้าสู่ระบบเพื่อดูคำขอของคุณ");
        return;
      }
      const { data, error } = await supabase
        .from("booking_requests")
        .select("id,category,fault_description,status,created_at")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        setMessage("โหลดรายการไม่สำเร็จ กรุณาลองใหม่ภายหลัง");
        return;
      }
      setRows(data ?? []);
      setMessage(data?.length ? "" : "ยังไม่มีคำขอ");
    })();
    return () => { active = false; };
  }, []);

  return (
    <section>
      <h1>คำขอของฉัน</h1>
      <p aria-live="polite">{message}</p>
      {message.includes("กรุณาเข้าสู่ระบบ") && <Link href="/login">ไปหน้าเข้าสู่ระบบ</Link>}
      {rows.map((item) => (
        <article className="card" key={item.id}>
          <strong>{item.category} · {item.status}</strong>
          <p>{item.fault_description}</p>
          <small className="muted">{item.id} · {new Date(item.created_at).toLocaleString("th-TH")}</small>
        </article>
      ))}
    </section>
  );
}
