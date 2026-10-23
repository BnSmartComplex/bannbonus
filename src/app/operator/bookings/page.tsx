"use client";
import { useCallback, useEffect, useState } from "react";
import { Clock3, CalendarCheck2, Send, RefreshCw } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import { validateSchedule, type ScheduleDraft } from "@/lib/schedule";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";

type Booking={
 id:string;tenant_id:string;category:string;area:string;status:string;created_at:string;
 service_district:"BANG_YAI"|"BANG_BUA_THONG"|null;service_address:string|null;
 service_latitude:number|null;service_longitude:number|null;
 address_verification_status:string|null;road_distance_meters:number|null;
 request_mode:"IMMEDIATE"|"BOOKING";desired_start:string|null;desired_end:string|null;
 alternative_start:string|null;alternative_end:string|null;alternative_technician_id:string|null;
 alternative_status:"NONE"|"PENDING_CUSTOMER"|"CUSTOMER_ACCEPTED"|"CUSTOMER_REJECTED";
};
type Technician={user_id:string};
function bangkok(iso:string):{date:string;time:string}{
 const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(iso));
 const part=(k:string)=>parts.find(p=>p.type===k)?.value??"";
 return {date:`${part("year")}-${part("month")}-${part("day")}`,time:`${part("hour")}:${part("minute")}`};
}
function initialDraft(item:Booking):ScheduleDraft{
 const start=item.alternative_status==="CUSTOMER_ACCEPTED"?item.alternative_start:item.desired_start;
 const end=item.alternative_status==="CUSTOMER_ACCEPTED"?item.alternative_end:item.desired_end;
 return {date:start?bangkok(start).date:"",startTime:start?bangkok(start).time:"",endTime:end?bangkok(end).time:""};
}
const label=(s:string)=>s==="PENDING_CUSTOMER"?"รอลูกค้าตอบรับ":s==="CUSTOMER_ACCEPTED"?"ลูกค้ายอมรับแล้ว":s==="CUSTOMER_REJECTED"?"ลูกค้าปฏิเสธ":"ยังไม่มีข้อเสนอใหม่";
export default function OperatorBookingsPage(){
 const supabase=getSupabase();
 const [bookings,setBookings]=useState<Booking[]>([]);
 const [techniciansByTenant,setDirectory]=useState<Record<string,Technician[]>>({});
 const [selected,setSelected]=useState<Record<string,string>>({});
 const [drafts,setDrafts]=useState<Record<string,ScheduleDraft>>({});
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState<string|null>(null);
 const [filter,setFilter]=useState<"ALL"|"IMMEDIATE"|"BOOKING">("ALL");
 const load=useCallback(async()=>{
  if(!supabase){setMessage("ยังไม่ได้เชื่อมต่อฐานข้อมูล");return;}
  const {data:{user}}=await supabase.auth.getUser();
  if(!user){setMessage("ต้องเข้าสู่ระบบเจ้าหน้าที่ก่อน");return;}
  const {data,error}=await supabase.from("booking_requests")
   .select("id,tenant_id,category,area,status,created_at,request_mode,desired_start,desired_end,alternative_start,alternative_end,alternative_technician_id,alternative_status,service_district,service_address,service_latitude,service_longitude,address_verification_status,road_distance_meters")
   .eq("status","PENDING_TEAM_REVIEW").order("created_at",{ascending:true});
  if(error){setMessage("โหลดรายการคำขอไม่สำเร็จหรือไม่มีสิทธิ์: "+error.message);return;}
  const rows=(data??[]) as Booking[];
  const ids=[...new Set(rows.map(x=>x.tenant_id))];
  const results=await Promise.all(ids.map(async id=>[id,await supabase.rpc("list_tenant_technicians",{p_tenant_id:id})] as const));
  const directory:Record<string,Technician[]>={};
  for(const [id,res] of results){if(res.error){setMessage(res.error.message);return;}directory[id]=(res.data??[]) as Technician[];}
  setDirectory(directory);setBookings(rows);if(!rows.length)setMessage("ขณะนี้ไม่มีคำขอรออนุมัติ");
 },[supabase]);
 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),20000);return()=>window.clearInterval(timer);},[load]);
 function updateDraft(id:string,key:keyof ScheduleDraft,value:string,base:ScheduleDraft){
  setDrafts(v=>({...v,[id]:{...(v[id]??base),[key]:value}}));
 }
 async function execute(item:Booking,action:"APPROVE"|"PROPOSE"){
  if(!supabase)return;
  const tech=selected[item.id]??(item.alternative_status==="CUSTOMER_ACCEPTED"?item.alternative_technician_id:"");
  if(!tech){setMessage("กรุณาเลือกช่างที่จะรับงาน");return;}
  let range:{startIso:string;endIso:string};
  if(item.request_mode==="IMMEDIATE"){
   // Keep the estimated start within the current service/price segment.
   // Never fabricate a slot ten minutes ahead across 21:00 or 02:00.
   const now=new Date();
   const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(now);
   const unit=(name:string)=>Number(parts.find(part=>part.type===name)?.value??0);
   const hour=unit("hour"),minute=unit("minute"),second=unit("second");
   const remains=(hour===20||hour===1)?3600-minute*60-second:Number.POSITIVE_INFINITY;
   const offsetMs=Math.min(30_000,(remains-10)*1000);
   if(offsetMs<5_000){setMessage("เวลาใกล้เปลี่ยนช่วงบริการหรือราคาเกินไป กรุณาเลือก Booking แทนเพื่อป้องกันยืนยันเวลาผิด");return;}
   const start=new Date(now.getTime()+offsetMs);
   const end=new Date(start.getTime()+60*60_000);
   range={startIso:start.toISOString(),endIso:end.toISOString()};
  }else{
   const schedule=validateSchedule(drafts[item.id]??initialDraft(item));
   if(!schedule.ok){setMessage(schedule.message);return;}
   range=schedule;
  }
  setBusy(item.id);setMessage("กำลังตรวจสอบสถานะและบันทึกผ่านฐานข้อมูล…");
  const call=action==="PROPOSE"?"propose_booking_alternative":
    item.request_mode==="IMMEDIATE"?"dispatch_and_assign_technician":"approve_booking_and_assign_technician";
  const params=action==="PROPOSE"
    ?{p_booking_id:item.id,p_technician_id:tech,p_start:range.startIso,p_end:range.endIso}
    :{p_booking_id:item.id,p_technician_id:tech,p_scheduled_start:range.startIso,p_scheduled_end:range.endIso};
  const {error}=await supabase.rpc(call,params);
  setBusy(null);
  if(error){setMessage("ดำเนินการไม่สำเร็จ: "+error.message);return;}
  setMessage(action==="PROPOSE"?"เสนอเวลาใหม่แล้ว รอลูกค้ากดยอมรับจากรายการ Booking":"ยืนยันงานและมอบหมายช่างสำเร็จ");
  await load();
 }
 return <section className="operator-board">
  <span className="section-kicker">DAY NERAMIT · OPERATIONS</span><h1>ศูนย์รับงานและจัดการ Booking</h1>
  <p className="muted">รายการเรียกทันทีและ Booking ล่วงหน้าอยู่ในหน้าจอเดียว · ตรวจคิวและอนุมัติจาก Backend</p>
  <div className="dashboard-actions"><button className="btn btn-outline" type="button" onClick={()=>void load()}><RefreshCw size={17}/> อัปเดตคำขอ</button></div>
  <p className="notice" role="status">{message}</p>
  <div className="request-modes" role="group" aria-label="กรองคำขอ"><button type="button" className={filter==="ALL"?"active":""} onClick={()=>setFilter("ALL")}>คำขอทั้งหมด</button><button type="button" className={filter==="IMMEDIATE"?"active":""} onClick={()=>setFilter("IMMEDIATE")}>เรียกช่างทันที</button><button type="button" className={filter==="BOOKING"?"active":""} onClick={()=>setFilter("BOOKING")}>Booking ล่วงหน้า</button></div>
  {bookings.filter(item=>filter==="ALL"||item.request_mode===filter).map(item=>{
   const draft=drafts[item.id]??initialDraft(item);
   const technicians=techniciansByTenant[item.tenant_id]??[];
   const customerAccepted=item.alternative_status==="CUSTOMER_ACCEPTED";
   const pending=item.alternative_status==="PENDING_CUSTOMER";
   const rejected=item.alternative_status==="CUSTOMER_REJECTED";
   const tech=selected[item.id]??(customerAccepted?item.alternative_technician_id??"":"");
   const mayApprove=item.request_mode==="IMMEDIATE"||customerAccepted||item.alternative_status==="NONE";
   return <article className="card booking-card" key={item.id}>
    <div className="booking-head"><div><span className="section-kicker">{item.request_mode==="IMMEDIATE"?"เรียกช่างทันที":"Booking ล่วงหน้า"}</span><h2>{item.category} · {item.area==="NONTHABURI"?"นนทบุรี":"กรุงเทพฯ"}</h2></div><span className="booking-state">{label(item.alternative_status)}</span></div>
    <small className="muted">งานเลขที่ {item.id}</small>
    <p><strong>จุดเริ่มต้น: สำนักงาน</strong> {dayNeramitBusiness.officeAddress}</p>
    <p><strong>บ้านลูกค้า:</strong> {item.service_address ?? "ยังไม่มีที่อยู่ (งานเดิม ต้องตรวจสอบ)"} · {
      item.service_district==="BANG_YAI"?"บางใหญ่":item.service_district==="BANG_BUA_THONG"?"บางบัวทอง":"ยังไม่ยืนยันอำเภอ"
    }</p>
    {item.service_address&&<p><a className="btn btn-outline" target="_blank" rel="noopener noreferrer"
      href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(dayNeramitBusiness.officeAddress)}&destination=${encodeURIComponent(item.service_latitude!==null&&item.service_longitude!==null?`${item.service_latitude},${item.service_longitude}`:item.service_address)}&travelmode=driving`}>
      ดูเส้นทางสำนักงาน → ลูกค้า บน Google Maps
    </a></p>}
    <p className="notice">{item.road_distance_meters===null
      ? "ยังไม่มีการยืนยันระยะทางขับรถจริง ต้องตรวจสอบก่อนเสนอค่าบริการและก่อนช่างออกเดินทาง"
      : `ระยะทางที่บันทึกในระบบ ${(item.road_distance_meters/1000).toFixed(2)} กม. (ตรวจสอบผู้ให้บริการและจุดต้นทางก่อนใช้)`}
      {" "}ราคาอ้างอิงตามเวลาออกเดินทางจริงจากสำนักงาน ไม่ใช่เวลาเริ่มงานที่บ้าน</p>
    {item.request_mode==="BOOKING"&&<p><Clock3 size={17}/> เวลาที่ลูกค้าเลือก: {item.desired_start?new Date(item.desired_start).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"}):"ไม่ระบุ"}</p>}
    {item.alternative_start&&<p className="notice">เวลาใหม่ที่เสนอ: {new Date(item.alternative_start).toLocaleString("th-TH",{timeZone:"Asia/Bangkok"})} · {label(item.alternative_status)}</p>}
    <div className="operator-fields">
     <div className="field"><label htmlFor={`tech-${item.id}`}>ช่างผู้รับงาน</label><select id={`tech-${item.id}`} value={tech} onChange={e=>setSelected(v=>({...v,[item.id]:e.target.value}))}><option value="">เลือกช่าง</option>{technicians.map(t=><option key={t.user_id} value={t.user_id}>{t.user_id.slice(0,8)}…</option>)}</select></div>
     {item.request_mode==="BOOKING"&&<>
      <div className="field"><label htmlFor={`date-${item.id}`}>วันที่</label><input id={`date-${item.id}`} type="date" value={draft.date} onChange={e=>updateDraft(item.id,"date",e.target.value,draft)}/></div>
      <div className="field"><label htmlFor={`from-${item.id}`}>เวลาเริ่ม</label><input id={`from-${item.id}`} type="time" value={draft.startTime} onChange={e=>updateDraft(item.id,"startTime",e.target.value,draft)}/></div>
      <div className="field"><label htmlFor={`to-${item.id}`}>เวลาสิ้นสุด</label><input id={`to-${item.id}`} type="time" value={draft.endTime} onChange={e=>updateDraft(item.id,"endTime",e.target.value,draft)}/></div>
     </>}
    </div>
    <div className="choice-buttons">
     {item.request_mode==="BOOKING"&&<button className="btn btn-outline" disabled={busy===item.id} type="button" onClick={()=>void execute(item,"PROPOSE")}><Send size={17}/> เสนอวันและเวลาใหม่ให้ลูกค้า</button>}
     <button className="btn btn-gold" disabled={busy===item.id||!mayApprove||(customerAccepted&&((tech!==item.alternative_technician_id)||(draft.date!==bangkok(item.alternative_start??"").date)||(draft.startTime!==bangkok(item.alternative_start??"").time)||(draft.endTime!==bangkok(item.alternative_end??"").time)))} type="button" onClick={()=>void execute(item,"APPROVE")}><CalendarCheck2 size={17}/> {item.request_mode==="IMMEDIATE"?"ตรวจสอบและจ่ายงาน":"ยืนยัน Booking และมอบหมาย"}</button>
    </div>
    {(pending||rejected)&&<p className="notice">ยืนยันนัดไม่ได้จนกว่าลูกค้าจะยอมรับข้อเสนอใหม่</p>}
   </article>;
  })}
 </section>;
}
