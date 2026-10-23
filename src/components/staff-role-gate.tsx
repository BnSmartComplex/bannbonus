"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type AllowedRole = "tenant_admin" | "operator" | "technician";
type State = "CHECKING" | "AUTHORIZED" | "LOGIN" | "DENIED" | "UNAVAILABLE";

function canOpenStaffPage(pathname: string, roles: AllowedRole[]): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/operator/") || pathname === "/staff" || pathname.startsWith("/staff/")) {
    return roles.includes("tenant_admin") || roles.includes("operator");
  }
  if (pathname.startsWith("/technician/")) return roles.includes("technician");
  return roles.length > 0;
}

/**
 * UX role guard only. Supabase RLS, security-definer RPC validation and database
 * permission grants remain mandatory. Direct URL navigation cannot skip this gate.
 */
export function StaffRoleGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<State>("CHECKING");

  useEffect(() => {
    if (pathname === "/" || pathname === "/login" || pathname === "/auth/callback") return;
    let mounted = true;
    const supabase = getSupabase();
    if (!supabase) {
      setStatus("UNAVAILABLE");
      return;
    }
    void (async () => {
      setStatus("CHECKING");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!mounted) return;
        if (!user || authError) { setStatus("LOGIN"); return; }
        const { data, error } = await supabase.from("tenant_memberships")
          .select("role")
          .eq("user_id", user.id)
          .in("role", ["tenant_admin", "operator", "technician"]);
        if (!mounted) return;
        if (error) { setStatus("UNAVAILABLE"); return; }
        const roles = (data ?? []).map(x => x.role)
          .filter((r): r is AllowedRole => r === "tenant_admin" || r === "operator" || r === "technician");
        setStatus(canOpenStaffPage(pathname, roles) ? "AUTHORIZED" : "DENIED");
      } catch {
        if (mounted) setStatus("UNAVAILABLE");
      }
    })();
    return () => { mounted = false; };
  }, [pathname]);

  if (pathname === "/" || pathname === "/login" || pathname === "/auth/callback") return <>{children}</>;
  if (status === "AUTHORIZED") return <>{children}</>;
  return <section className="card" style={{maxWidth:620,margin:"70px auto",padding:25}} aria-live="polite">
    {status === "CHECKING" && <p>กำลังตรวจสอบสิทธิ์ทีมงาน…</p>}
    {status === "LOGIN" && <><h1>เข้าสู่ระบบทีมงาน</h1>
      <p>สำหรับช่าง เจ้าหน้าที่ และ Admin ที่ได้รับอนุญาตเท่านั้น</p>
      <Link className="btn btn-gold" href="/login">เข้าสู่ระบบ</Link></>}
    {status === "DENIED" && <><h1>ไม่มีสิทธิ์เข้าถึง</h1>
      <p>บัญชีนี้ไม่ได้รับสิทธิ์สำหรับส่วนงานนี้</p><a href="https://chang24.vercel.app">ไปเว็บไซต์ลูกค้า Chang24</a></>}
    {status === "UNAVAILABLE" && <><h1>ระบบตรวจสอบสิทธิ์ยังไม่พร้อม</h1>
      <p>ไม่สามารถเปิดข้อมูลภายในโดยไม่ได้ยืนยันสิทธิ์ กรุณาแจ้งผู้ดูแลระบบ</p>
      <Link href="/">กลับหน้าหลักทีมงาน</Link></>}
  </section>;
}
