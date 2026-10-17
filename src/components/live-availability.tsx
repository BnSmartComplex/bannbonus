"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CircleAlert, CircleCheck, Clock3, RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type Overview = { service_open: boolean; available_technicians: number; status: "AVAILABLE" | "BUSY" | "CLOSED" | "UNKNOWN"; checked_at?: string };

export function LiveAvailability({ category = "OTHER", area = "NONTHABURI", compact = false, onAreaChange, onCategoryChange }: {category?: string;area?: string;compact?: boolean;onAreaChange?:(value:"BANGKOK"|"NONTHABURI")=>void;onCategoryChange?:(value:string)=>void}) {
  const [data, setData] = useState<Overview | null>(null);
  const [checking, setChecking] = useState(true);
  const [selectedArea, setSelectedArea] = useState(area);
  const [selectedCategory, setSelectedCategory] = useState(category);
  useEffect(() => { setSelectedArea(area); }, [area]);
  useEffect(() => { setSelectedCategory(category); }, [category]);
  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    const refresh = async () => {
      if (!supabase) { if(active){setData(null);setChecking(false);}return; }
      const { data: raw, error } = await supabase.rpc("public_dispatch_overview", {
        p_area: selectedArea, p_skill: selectedCategory
      });
      if (!active) return;
      const row = Array.isArray(raw) ? raw[0] : raw;
      if (error || !row || !["AVAILABLE", "BUSY", "CLOSED", "UNKNOWN"].includes(row.status)) setData(null);
      else setData(row as Overview);
      setChecking(false);
    };
    setChecking(true);
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active = false;window.clearInterval(timer);document.removeEventListener("visibilitychange", onVisible); };
  }, [selectedArea, selectedCategory]);
  const status = data?.status ?? "UNKNOWN";
  const label = checking ? "กำลังตรวจสอบสถานะ…" : status === "AVAILABLE" ? "มีช่างที่ผ่านเกณฑ์พร้อมรับคำขอ" : status === "BUSY" ? "ช่างไม่ว่างในขณะนี้" : status === "CLOSED" ? "ขณะนี้นอกเวลาเรียกช่างทันที" : "ยังตรวจสอบสถานะช่างไม่ได้";
  return <div className={`availability-panel ${compact ? "compact" : ""}`} aria-live="polite">
    <div className="availability-top"><span><Activity size={18}/> สถานะทีมช่าง</span><span className="refresh-indicator"><RefreshCw size={13}/> อัปเดตทุก 30 วินาที</span></div>
    <div className="availability-filters"><label>พื้นที่<select value={selectedArea} onChange={e=>{const next=e.target.value as "BANGKOK"|"NONTHABURI";setSelectedArea(next);onAreaChange?.(next);}}><option value="NONTHABURI">นนทบุรี</option><option value="BANGKOK">กรุงเทพมหานคร</option></select></label><label>ประเภทงาน<select value={selectedCategory} onChange={e=>{setSelectedCategory(e.target.value);onCategoryChange?.(e.target.value);}}><option value="OTHER">งานช่างทั่วไป</option><option value="AIR_CONDITIONER">เครื่องปรับอากาศ</option><option value="ELECTRICAL">ไฟฟ้า</option><option value="PLUMBING">ประปา</option><option value="REFRIGERATOR">ตู้เย็น</option><option value="WASHING_MACHINE">เครื่องซักผ้า</option><option value="ELECTRONICS">อิเล็กทรอนิกส์</option></select></label></div>
    <div className={`status-display status-${status.toLowerCase()}`}><span className="status-light"/><div>{status === "AVAILABLE" ? <CircleCheck size={23}/> : status === "UNKNOWN" ? <CircleAlert size={23}/> : <Clock3 size={23}/>}<strong>{label}</strong></div><p>{status === "AVAILABLE" ? "สามารถส่งคำขอเรียกช่างทันทีได้ แต่ทีมงานต้องยืนยันและช่างต้องรับงานก่อนออกเดินทาง" : "คุณสามารถส่งคำขอ Booking ล่วงหน้าได้ตลอด 24 ชั่วโมง โดยทีมงานจะตรวจสอบและเสนอเวลาที่เหมาะสม"}</p></div>
    <div className="availability-actions"><Link className="btn btn-gold" href={status === "AVAILABLE" ? `/booking?mode=IMMEDIATE&area=${selectedArea}&category=${selectedCategory}` : `/booking?mode=BOOKING&area=${selectedArea}&category=${selectedCategory}`}>{status === "AVAILABLE" ? "ส่งคำขอเรียกช่าง" : "Booking วันหรือเวลาอื่น"}</Link><Link className="inline-link" href="/my-bookings">รายการจองของฉัน →</Link></div>
  </div>;
}
