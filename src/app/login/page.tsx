"use client";

import { useState, type FormEvent } from "react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
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
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/booking`,
        },
      });
      setMessage(otpError
        ? "ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อทีมงาน"
        : "หากอีเมลนี้มีบัญชีที่ได้รับอนุญาต ระบบจะส่งลิงก์เข้าสู่ระบบให้");
    } catch {
      setMessage("ส่งลิงก์ไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อทีมงาน");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1>เข้าสู่ระบบ</h1>
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
