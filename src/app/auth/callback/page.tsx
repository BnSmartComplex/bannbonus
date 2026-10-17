"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("กำลังยืนยันการเข้าสู่ระบบ…");

  useEffect(() => {
    let active=true;
    const next = new URLSearchParams(window.location.search).get("next");
    // Prevent redirect to arbitrary external URL.
    const dest = next && /^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(next) ? next : "/";
    const supabase = getSupabase();
    if (!supabase) { setMessage("ยังไม่สามารถเชื่อมต่อระบบเข้าสู่ระบบได้"); return; }
    void (async () => {
      try {
        const oauthError = new URLSearchParams(window.location.search).get("error_description");
        if (oauthError) { if(active)setMessage("Google ไม่อนุญาตให้เข้าสู่ระบบ กรุณาลองใหม่"); return; }
        const code = new URLSearchParams(window.location.search).get("code");
        if (code) {
          // Required for PKCE flow; Supabase also supports its implicit hash flow.
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) { if(active)setMessage("ยืนยัน Google ไม่สำเร็จ กรุณากลับไปเข้าสู่ระบบใหม่"); return; }
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { if(active)setMessage("ยังไม่ได้เข้าสู่ระบบ กรุณาลองอีกครั้ง"); return; }
        if (active) window.location.replace(dest);
      } catch {
        if(active)setMessage("การเข้าสู่ระบบขัดข้อง กรุณาลองใหม่");
      }
    })();
    return ()=>{active=false;};
  }, []);

  return <section className="simple-login"><div className="login-shell">
    <h1>เข้าสู่ระบบ Google</h1>
    <p role="status">{message}</p>
    <Link className="btn btn-outline" href="/login">กลับไปเข้าสู่ระบบ</Link>
  </div></section>;
}
