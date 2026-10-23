"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { customerDestination } from "@/lib/customer-destination";
import { customerLoginDestinationKey, redirectCustomerToChang24 } from "@/lib/portal-redirect";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("กำลังยืนยันการเข้าสู่ระบบ…");

  useEffect(() => {
    let active=true;
    const next = new URLSearchParams(window.location.search).get("next");
    const staffPortal = process.env.NEXT_PUBLIC_APP_PORTAL === "STAFF";
    let storedNext: string | null = null;
    if (!staffPortal) {
      try { storedNext = window.sessionStorage.getItem(customerLoginDestinationKey); } catch { /* Use the callback fallback. */ }
    }
    const dest = staffPortal ? "/" : customerDestination(storedNext ?? next);
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
        if (staffPortal) {
          const { data, error } = await supabase.from("tenant_memberships")
            .select("role")
            .eq("user_id", user.id)
            .in("role", ["tenant_admin", "operator", "technician"]);
          if (error) { if(active)setMessage("ตรวจสอบสิทธิ์ทีมงานไม่สำเร็จ กรุณาลองใหม่"); return; }
          if (!data?.length) {
            if (active && !redirectCustomerToChang24()) setMessage("บัญชีนี้เป็นลูกค้า กรุณาไปที่ Chang24");
            return;
          }
        } else {
          try { window.sessionStorage.removeItem(customerLoginDestinationKey); } catch { /* Storage may be disabled. */ }
        }
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
    {process.env.NEXT_PUBLIC_APP_PORTAL === "STAFF" && <a className="btn btn-gold" href="https://chang24.vercel.app/login?next=%2Fbooking">ไปหน้าเข้าสู่ระบบลูกค้า Chang24</a>}
    <Link className="btn btn-outline" href="/login">กลับไปเข้าสู่ระบบ</Link>
  </div></section>;
}
