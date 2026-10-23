"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { GoogleIcon } from "@/components/google-icon";
import { customerDestination } from "@/lib/customer-destination";

export default function LoginPage() {
  const staffPortal = process.env.NEXT_PUBLIC_APP_PORTAL === "STAFF";
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loginWithGoogle() {
    setMessage("");
    const supabase = getSupabase();
    if (!supabase) {
      setMessage("ระบบเข้าสู่ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อทีมงาน");
      return;
    }
    setBusy(true);
    try {
      const requestedNext = new URLSearchParams(window.location.search).get("next");
      const next = staffPortal ? "/" : customerDestination(requestedNext);
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("next", next);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString(), queryParams: { prompt: "select_account" } },
      });
      if (error) {
        setMessage("เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง หรือติดต่อทีมงาน");
        setBusy(false);
      }
      // On success the browser navigates to Google; do not claim authentication yet.
    } catch {
      setMessage("ไม่สามารถเชื่อมต่อ Google ได้ในขณะนี้ กรุณาลองใหม่");
      setBusy(false);
    }
  }

  return <section className="simple-login" aria-labelledby="login-title">
    <div className="login-shell">
      <span className="section-kicker">DAY NERAMIT</span>
      <h1 id="login-title">{staffPortal ? "เข้าสู่ระบบทีมงาน" : "เข้าสู่ระบบ"}</h1>
      <p className="muted">{staffPortal
        ? "สำหรับช่างและผู้ดูแลที่ได้รับสิทธิ์เท่านั้น"
        : "เลือกบัญชี Google เพื่อเริ่มเรียกช่างหรือนัดหมาย ไม่ต้องรอลิงก์ทางอีเมล"}</p>
      <button className="google-login-button" type="button" onClick={() => void loginWithGoogle()} disabled={busy}>
        <GoogleIcon /> {busy ? "กำลังเปิด Google…" : "ดำเนินการต่อด้วย Google"}
      </button>
      {message && <p className="error" role="alert">{message}</p>}
      {staffPortal && <small className="muted">การเข้าด้วย Google ไม่ได้ให้สิทธิ์ทีมงานอัตโนมัติ ต้องได้รับอนุมัติสิทธิ์จาก Admin ก่อน</small>}
      <small className="muted">เข้าสู่ระบบผ่าน Google โดยตรง ไม่มีการส่งลิงก์ยืนยันเข้าอีเมล</small>
    </div>
  </section>;
}
