"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase";

type นัดหมายItem={
 id:string;category:string;area:string;fault_description:string;
 status:string;request_mode:"IMMEDIATE"|"BOOKING";created_at:string;
 desired_start:string|null;desired_end:string|null;
 alternative_start:string|null;alternative_end:string|null;
 alternative_status:"NONE"|"PENDING_CUSTOMER"|"CUSTOMER_ACCEPTED"|"CUSTOMER_REJECTED";
};
const statusLabels:Record<string,string>={
 PENDING_TEAM_REVIEW:"รอทีมงานตรวจสอบ",CONFIRMED:"ยืนยันนัดหมายแล้ว",
 DECLINED:"ทีมงานไม่สามารถรับงาน",CANCELLED:"คำขอถูกยกเลิก"
};
function localDate(iso:string|null){return iso?new Date(iso).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}):"ยังไม่ระบุ";}
export default function MyนัดหมายsPage(){
 const [rows,setRows]=useState<นัดหมายItem[]>([]);
 const [message,setMessage]=useState("กำลังตรวจสอบสิทธิ์และโหลด นัดหมาย…");
 const [busy,setBusy]=useState<string|null>(null);
 const [filter,setFilter]=useState<"ALL"|"IMMEDIATE"|"BOOKING">("ALL");
 const load=useCallback(async()=>{
  const supabase=getSupabase();
  if(!supabase){setMessage("ระบบฐานข้อมูลยังไม่ได้รับการตั้งค่า");return;}
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||!user){setMessage("กรุณาเข้าสู่ระบบเพื่อดูคำขอของคุณ");return;}
  const {data,error}=await supabase.from("booking_requests")
   .select("id,category,area,fault_description,status,request_mode,created_at,desired_start,desired_end,alternative_start,alternative_end,alternative_status")
   .eq("customer_id",user.id).order("created_at",{ascending:false});
  if(error){setMessage("โหลดรายการจองไม่สำเร็จ กรุณาลองอีกครั้ง");return;}
  setRows((data??[]) as นัดหมายItem[]);
  setMessage(data?.length?"":"ยังยังไม่มีรายการเรียกช่างหรือนัดหมาย");
 },[]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),20000);return()=>window.clearInterval(timer);},[load]);
 async function respond(id:string,accept:boolean){
  const client=getSupabase();if(!client)return;
  setBusy(id);setMessage("");
  const {error}=await client.rpc("respond_booking_alternative",{p_booking_id:id,p_accept:accept});
  setBusy(null);
  if(error){setMessage("ไม่สามารถบันทึกคำตอบได้: "+error.message);return;}
  setMessage(accept?"รับเวลาที่เสนอแล้ว กรุณารอทีมงานยืนยัน นัดหมายอีกครั้ง":"ปฏิเสธเวลาที่เสนอแล้ว เจ้าหน้าที่สามารถเสนอเวลาใหม่ได้");
  await load();
 }
 return <section className="booking-dashboard">
  <span className="section-kicker">MY SERVICE REQUESTS</span>
  <h1>รายการเรียกช่างและนัดหมาย</h1>
  <p className="muted">แสดงรายการเรียกช่างทันทีและจองล่วงหน้าในหน้าเดียว · ตรวจอัปเดตทุก 20 วินาที</p>
  <div className="dashboard-actions"><Link className="btn btn-gold" href="/booking">เรียกช่างหรือนัดหมาย <ArrowRight size={16}/></Link><button className="btn btn-outline" onClick={()=>void load()} type="button">รีเฟรชสถานะ</button></div>
  {message&&<p className="notice" aria-live="polite">{message} {message.includes("เข้าสู่ระบบ")&&<Link href="/login">เข้าสู่ระบบ →</Link>}</p>}
  <div className="request-modes" role="group" aria-label="กรองรายการจอง"><button type="button" className={filter==="ALL"?"active":""} onClick={()=>setFilter("ALL")}>ทั้งหมด</button><button type="button" className={filter==="IMMEDIATE"?"active":""} onClick={()=>setFilter("IMMEDIATE")}>เรียกทันที</button><button type="button" className={filter==="BOOKING"?"active":""} onClick={()=>setFilter("BOOKING")}>นัดหมายล่วงหน้า</button></div>
  <div className="booking-list">{rows.filter(item=>filter==="ALL"||item.request_mode===filter).map(item=><article className="card booking-card" key={item.id}>
   <div className="booking-head"><div><span className="section-kicker">{item.request_mode==="IMMEDIATE"?"เรียกช่างทันที":"นัดหมายล่วงหน้า"}</span><h2>{item.category.replaceAll("_"," ")} · {item.area==="NONTHABURI"?"นนทบุรี":"กรุงเทพฯ"}</h2></div><span className={`booking-state ${item.status==="CONFIRMED"?"confirmed":""}`}>{statusLabels[item.status]??item.status}</span></div>
   <p className="muted">{item.fault_description}</p>
   {item.request_mode==="BOOKING"&&<p className="booking-date"><CalendarClock size={17}/> เวลาที่ขอ: {localDate(item.desired_start)} – {localDate(item.desired_end)}</p>}
   {item.alternative_start&&<div className="alternative-offer">
    <strong><Clock size={18}/> ทีมช่างเสนอวันหรือเวลาใหม่</strong>
    <p>{localDate(item.alternative_start)} – {localDate(item.alternative_end)}</p>
    {item.alternative_status==="PENDING_CUSTOMER"&&<><p>ช่างไม่สะดวกในเวลาที่เลือก คุณยอมรับวันและเวลานี้หรือไม่?</p><div className="choice-buttons"><button className="btn btn-gold" disabled={busy===item.id} onClick={()=>void respond(item.id,true)}><CheckCircle2 size={16}/> ตกลง ยอมรับเวลานี้</button><button className="btn btn-outline" disabled={busy===item.id} onClick={()=>void respond(item.id,false)}><XCircle size={16}/> ไม่สะดวก ขอเวลาอื่น</button></div></>}
    {item.alternative_status==="CUSTOMER_ACCEPTED"&&<p className="ok">คุณยอมรับเวลาใหม่แล้ว · รอทีมงานยืนยันคิวอีกครั้ง</p>}
    {item.alternative_status==="CUSTOMER_REJECTED"&&<p className="notice">คุณปฏิเสธเวลานี้แล้ว · รอทีมงานเสนอใหม่</p>}
   </div>}
   {item.status==="CONFIRMED"&&<p className="ok"><CheckCircle2 size={18}/> ทีมงานยืนยัน นัดหมาย แล้ว โปรดตรวจสอบรายละเอียดการนัดหมาย</p>}
   <small className="muted">งาน #{item.id.slice(0,8)} · {localDate(item.created_at)}</small>
  </article>)}</div>
 </section>;
}
