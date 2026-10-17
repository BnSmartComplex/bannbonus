"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { ClipboardList, HardHat, ShieldCheck, LogIn, RefreshCw } from "lucide-react";

type StaffRole = "operator" | "tenant_admin" | "technician";
type StaffState = "CHECKING" | "LOGIN_REQUIRED" | "NO_CONFIG" | "FORBIDDEN" | "AUTHORIZED" | "ERROR";

export function StaffPortalHome() {
  const [status, setStatus] = useState<StaffState>("CHECKING");
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [busy, setBusy] = useState(false);

  async function checkRole() {
    const supabase = getSupabase();
    if (!supabase) { setStatus("NO_CONFIG"); return; }
    setBusy(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) { setRoles([]); setStatus("LOGIN_REQUIRED"); return; }
      const { data, error } = await supabase
        .from("tenant_memberships")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["tenant_admin", "operator", "technician"]);
      if (error) { setStatus("ERROR"); return; }
      const permitted = (data ?? []).map(x => x.role)
        .filter((x): x is StaffRole => x === "tenant_admin" || x === "operator" || x === "technician");
      setRoles(permitted);
      setStatus(permitted.length ? "AUTHORIZED" : "FORBIDDEN");
    } catch { setStatus("ERROR"); }
    finally { setBusy(false); }
  }

  useEffect(() => { void checkRole(); }, []);
  const isAdmin = roles.includes("tenant_admin") || roles.includes("operator");
  const isTechnician = roles.includes("technician");

  return <section style={{maxWidth:950,margin:"0 auto",padding:"45px 0 100px"}}>
    <span className="section-kicker">BANNBONUS · STAFF OPERATIONS</span>
    <h1>ศูนย์จัดการงานช่างและผู้ดูแลระบบ</h1>
    <p className="muted">พื้นที่สำหรับทีมช่างและ Admin เท่านั้น · ลูกค้าเรียกช่างและนัดหมายที่ <a href="https://chang24.vercel.app" style={{textDecoration:"underline"}}>chang24.vercel.app</a></p>
    {status === "CHECKING" && <p className="notice" role="status">กำลังตรวจสอบบัญชีและสิทธิ์ทีมงาน…</p>}
    {status === "NO_CONFIG" && <p className="notice" role="alert">ระบบฝ่ายปฏิบัติการยังไม่ได้เชื่อมต่อฐานข้อมูล Production จึงไม่เปิดให้ใช้งานข้อมูลจริง</p>}
    {status === "LOGIN_REQUIRED" && <div className="card"><h2>กรุณาเข้าสู่ระบบทีมงาน</h2>
      <p>เฉพาะบัญชีที่ได้รับสิทธิ์ช่าง ผู้ประสานงาน หรือผู้ดูแลระบบเท่านั้น</p>
      <Link className="btn btn-gold" href="/login"><LogIn size={18}/> เข้าสู่ระบบ</Link></div>}
    {status === "FORBIDDEN" && <div className="card" role="alert">
      <h2>บัญชีนี้ไม่มีสิทธิ์ทีมงาน</h2><p>กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดสิทธิ์ ไม่สามารถใช้งานหน้า Admin หรือหน้าช่างด้วยบัญชีลูกค้าทั่วไป</p>
    </div>}
    {status === "ERROR" && <p className="notice" role="alert">ตรวจสอบสิทธิ์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>}
    {status === "AUTHORIZED" && <div className="service-grid" aria-label="เมนูทีมงาน">
      {isAdmin && <Link className="card" href="/operator/bookings"><ShieldCheck size={27}/><h2>Admin / จัดการงาน</h2>
        <p>ตรวจรายการเรียกช่างและนัดหมาย เสนอคิว ยืนยัน และมอบหมายงาน</p></Link>}
      {isAdmin && <Link className="card" href="/staff"><ClipboardList size={27}/><h2>ศูนย์รับงาน</h2><p>ดูรายการงานภายใต้สิทธิ์ที่ได้รับอนุญาต</p></Link>}
      {isTechnician && <Link className="card" href="/technician/jobs"><HardHat size={27}/><h2>งานของฉัน / ช่าง</h2><p>จัดการสถานะออนไลน์ รับงาน และบันทึกความคืบหน้า</p></Link>}
    </div>}
    {(status === "AUTHORIZED" || status === "ERROR") && <p style={{marginTop:20}}>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={()=>void checkRole()}><RefreshCw size={16}/> ตรวจสอบสิทธิ์อีกครั้ง</button></p>}
    <p className="muted" style={{marginTop:32,fontSize:13}}>การเข้าถึงข้อมูลลูกค้าขึ้นอยู่กับสิทธิ์ในฐานข้อมูล ไม่ใช่เพียงการแสดงเมนู เว็บไซต์นี้ไม่ใช่หน้าสำหรับลูกค้าเรียกช่าง</p>
  </section>;
}
