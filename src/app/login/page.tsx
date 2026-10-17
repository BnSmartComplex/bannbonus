"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const staffPortal = process.env.NEXT_PUBLIC_APP_PORTAL === "STAFF";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = getSupabase();
    if (!supabase) {
      setMessage("ยังไม่ได้ตั้งค่า Supabase สำหรับสภาพแวดล้อมนี้");
      return;
    }

    setBusy(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: !staffPortal,
          emailRedirectTo: `${window.location.origin}${staffPortal ? "/" : "/booking"}`,
        },
      });
      setMessage(otpError
        ? "ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อทีมงาน"
        : "หากระบบส่งอีเมลได้สำเร็จ กรุณาเปิดลิงก์ยืนยันเพื่อเข้าสู่ระบบ");
    } catch {
      setMessage("ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อทีมงาน");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>{staffPortal ? "เข้าสู่ระบบช่างและ Admin" : "เข้าสู่ระบบลูกค้า"}</h1>
      {staffPortal && <p className="notice">ใช้บัญชีทีมงานที่ได้รับสิทธิ์จากผู้ดูแลระบบเท่านั้น · หน้าเข้าสู่ระบบนี้ไม่สร้างบัญชีใหม่</p>}
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">อีเมล</label>
          <input
            autoComplete="email"
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
        </button>
        {message && <p aria-live="polite">{message}</p>}
      </form>
    </section>
  );
}
