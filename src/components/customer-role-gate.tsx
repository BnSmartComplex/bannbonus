"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type State = "CHECKING" | "READY" | "LOGIN" | "STAFF" | "UNAVAILABLE";

export function CustomerRoleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const protectedPage = pathname === "/booking" || pathname === "/my-bookings";
  const [status, setStatus] = useState<State>("CHECKING");

  useEffect(() => {
    if (!protectedPage) return;
    let active = true;
    const supabase = getSupabase();
    if (!supabase) {
      setStatus("UNAVAILABLE");
      return;
    }
    void (async () => {
      setStatus("CHECKING");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!active) return;
        if (authError || !user) { setStatus("LOGIN"); return; }
        const { data, error } = await supabase.from("tenant_memberships")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["tenant_admin", "operator", "technician"]);
        if (!active) return;
        setStatus(error ? "UNAVAILABLE" : data?.length ? "STAFF" : "READY");
      } catch {
        if (active) setStatus("UNAVAILABLE");
      }
    })();
    return () => { active = false; };
  }, [pathname, protectedPage]);

  if (!protectedPage || status === "READY") return <>{children}</>;
  return <section className="simple-login" aria-live="polite"><div className="login-shell">
    {status === "CHECKING" && <p>กำลังตรวจสอบบัญชี…</p>}
    {status === "LOGIN" && <>
      <h1>เข้าสู่ระบบก่อนส่งคำขอ</h1>
      <p>เข้าสู่ระบบแล้วกลับมากรอกรายละเอียดงานที่นี่</p>
      <Link className="btn btn-gold" href={`/login?next=${encodeURIComponent(pathname)}`}>เข้าสู่ระบบด้วย Google</Link>
    </>}
    {status === "STAFF" && <>
      <h1>บัญชีทีมงาน</h1>
      <p>บัญชีนี้ใช้จัดการงานที่ BannBonus</p>
      <a className="btn btn-gold" href="https://bannbonus.vercel.app">ไปหน้า BannBonus</a>
    </>}
    {status === "UNAVAILABLE" && <>
      <h1>ตรวจสอบสิทธิ์ไม่ได้</h1>
      <p>กรุณาลองใหม่อีกครั้ง</p>
    </>}
  </div></section>;
}
