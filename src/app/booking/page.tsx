"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateSchedule, type ScheduleDraft } from "@/lib/schedule";
import { LiveAvailability } from "@/components/live-availability";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { booking } from "@/lib/validation";
import { ServiceTerms } from "@/components/service-terms";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";

const categories = [
  ["OTHER", "อื่น ๆ / ไม่ทราบประเภท"],
  ["AIR_CONDITIONER", "เครื่องปรับอากาศ"],
  ["REFRIGERATOR", "ตู้เย็น"],
  ["WASHING_MACHINE", "เครื่องซักผ้า"],
  ["ELECTRICAL", "ไฟฟ้า"],
  ["PLUMBING", "ประปา"],
  ["ELECTRONICS", "อิเล็กทรอนิกส์"],
] as const;

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const idempotencyStorageKey = "chang24:booking-request-idempotency-key";

type RoutePricing = {
  status: "QUOTABLE" | "CLOSED" | "PRICING_NOT_APPROVED";
  requestAt: string;
  distanceMeters: number;
  extraMeters: number;
  baseFeeBaht: number | null;
  extraFeeBaht: number | null;
  totalBaht: number | null;
  rounding: "PRO_RATA" | "CEIL_KILOMETRE" | null;
};
type RouteQuote = {
  distanceMeters: number;
  durationMinutes: number;
  departureAt: string;
  estimatedArrivalAt: string;
  pricing: RoutePricing;
  approvedExcessRateBahtPerKm: number | null;
};
type PricePopup =
  | { kind: "QUOTE" | "RATE_PENDING"; route: RouteQuote }
  | { kind: "CLOSED" | "UNAVAILABLE" };
const baht = (value: number | null) =>
  value === null ? "ยังไม่กำหนด" : value.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " บาท";

type FormValues = {
  category: string;
  fault_description: string;
  brand: string;
  model_number: string;
  area: "BANGKOK" | "NONTHABURI";
  district: "BANG_YAI" | "BANG_BUA_THONG";
  service_address: string;
  contact_name: string;
  contact_phone: string;
  consent: boolean;
};

export default function BookingPage() {
  const configured = Boolean(getSupabase());
  const [mode, setMode] = useState<"IMMEDIATE"|"BOOKING">("BOOKING");
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft>({date:"",startTime:"",endTime:""});
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setMode(query.get("mode") === "IMMEDIATE" ? "IMMEDIATE" : "BOOKING");
    const category = query.get("category");
    setValues(current => ({...current,
      category: category && categories.some(([key]) => key === category) ? category : current.category,
    }));
  }, []);
  const [values, setValues] = useState<FormValues>({
    category: "OTHER",
    fault_description: "",
    brand: "",
    model_number: "",
    area: "NONTHABURI",
    district: "BANG_YAI",
    service_address: "",
    contact_name: "",
    contact_phone: "",
    consent: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [customerCoords, setCustomerCoords] = useState<{latitude:number;longitude:number}|null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");
  const [checkingDistance, setCheckingDistance] = useState(false);
  const [distance, setDistance] = useState<RouteQuote | null>(null);
  const [popup, setPopup] = useState<PricePopup | null>(null);
  const [realtimeOpen, setRealtimeOpen] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const response = await fetch("/api/realtime-window", {cache:"no-store"});
        const data = await response.json();
        if(active && response.ok && typeof data.realtimeOpen === "boolean") {
          setRealtimeOpen(data.realtimeOpen);
        }
      } catch { if(active) setRealtimeOpen(null); }
    };
    void check();
    const timer = window.setInterval(() => void check(), 20_000);
    const onVisible = () => { if(document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { active=false;window.clearInterval(timer);document.removeEventListener("visibilitychange",onVisible); };
  }, []);

  useEffect(() => {
    if (mode === "IMMEDIATE" && realtimeOpen === false) {
      setMode("BOOKING");
      setPopup({kind:"CLOSED"});
    }
  }, [mode, realtimeOpen]);

  function resetIdempotencyKey() {
    idempotencyKey.current = null;
    window.sessionStorage.removeItem(idempotencyStorageKey);
    setSuccess("");
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    resetIdempotencyKey();
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function requestRoute(destination: { latitude:number; longitude:number } | { address:string; district:"BANG_YAI"|"BANG_BUA_THONG" }) {
    setCheckingDistance(true);
    setDistance(null);
    const supabase = getSupabase();
    const { data: { session } } = supabase
      ? await supabase.auth.getSession()
      : { data: { session: null } };
    if (!session) {
      setGeoMessage("กรุณาเข้าสู่ระบบก่อนดูระยะทางอัตโนมัติ หรือเปิด Google Maps ดูเส้นทางได้");
      setCheckingDistance(false);
      return;
    }
    try {
      const response = await fetch("/api/route-distance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(destination),
        cache: "no-store",
      });
      const result = await response.json();
      if (response.ok && typeof result.distanceMeters === "number"
          && typeof result.durationMinutes === "number") {
        setDistance(result);
        setGeoMessage("คำนวณเส้นทางขับรถจากสำนักงานไปหาลูกค้าแล้ว (ยังไม่ใช่การยืนยันค่าบริการ)");
      } else {
        setGeoMessage("ยังคำนวณระยะทางอัตโนมัติไม่ได้ กรุณาดูเส้นทางใน Google Maps หรือให้ทีมงานตรวจสอบ");
      }
    } catch {
      setGeoMessage("บริการคำนวณเส้นทางขัดข้อง กรุณาใช้ Google Maps หรือให้ทีมงานตรวจสอบ");
    } finally {
      setCheckingDistance(false);
    }
  }

  function previewAddressRoute() {
    if (values.service_address.trim().length < 15) {
      setGeoMessage("กรุณากรอกที่อยู่ลูกค้าให้ครบก่อนคำนวณระยะทาง");
      return;
    }
    setCustomerCoords(null);
    setLocationConfirmed(false);
    void requestRoute({ address: values.service_address.trim(), district: values.district });
  }

  function useMyLocation() {
    setDistance(null);
    setGeoMessage("");
    setLocationConfirmed(false);
    if (!navigator.geolocation) {
      setGeoMessage("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง กรุณากรอกที่อยู่เพื่อให้เจ้าหน้าที่ตรวจสอบ");
      return;
    }
    setCheckingDistance(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const point = { latitude: coords.latitude, longitude: coords.longitude };
      setCustomerCoords(point);
      resetIdempotencyKey();
      setGeoMessage("ได้รับพิกัดจากอุปกรณ์แล้ว โปรดยืนยันว่าตำแหน่งนี้ตรงกับบ้านที่ต้องการให้ช่างไป");
      setCheckingDistance(false);
    }, () => {
      setCustomerCoords(null);
      setGeoMessage("ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณากรอกที่อยู่ให้ครบเพื่อให้เจ้าหน้าที่ตรวจสอบ");
      setCheckingDistance(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  }

  function openDirections() {
    if (!customerCoords && values.service_address.trim().length < 15) return;
    const origin = encodeURIComponent(dayNeramitBusiness.officeAddress);
    const districtName = values.district === "BANG_YAI" ? "อำเภอบางใหญ่" : "อำเภอบางบัวทอง";
    const destination = encodeURIComponent(customerCoords && locationConfirmed
      ? `${customerCoords.latitude},${customerCoords.longitude}`
      : `${values.service_address.trim()}, ${districtName}, นนทบุรี`);
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`, "_blank", "noopener,noreferrer");
  }

  async function showRealtimePopup() {
    setError("");
    if (values.service_address.trim().length < 15) {
      setError("กรุณากรอกที่อยู่บ้านหรือจุดนัดหมายให้ครบก่อนเรียกช่าง");
      return;
    }
    const supabase = getSupabase();
    const {data:{session}} = supabase
      ? await supabase.auth.getSession()
      : {data:{session:null}};
    if(!session) {
      setError("กรุณาเข้าสู่ระบบก่อนกดเรียกช่าง");
      return;
    }
    setBusy(true);
    try {
      const gateRes = await fetch("/api/realtime-window", {cache:"no-store"});
      if(!gateRes.ok) throw new Error("SERVICE_CLOCK_UNAVAILABLE");
      const gate = await gateRes.json();
      setRealtimeOpen(Boolean(gate.realtimeOpen));
      if(!gate.realtimeOpen) {
        setMode("BOOKING");
        setPopup({kind:"CLOSED"});
        return;
      }
      const destination = locationConfirmed && customerCoords
        ? customerCoords
        : {address:values.service_address.trim(),district:values.district};
      const routeResponse = await fetch("/api/route-distance", {
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
        body:JSON.stringify(destination),cache:"no-store",
      });
      if(!routeResponse.ok) {
        setPopup({kind:"UNAVAILABLE"});
        return;
      }
      const route = await routeResponse.json() as RouteQuote;
      setDistance(route);
      if(route.pricing.status === "CLOSED") {
        setMode("BOOKING");
        setPopup({kind:"CLOSED"});
      } else if(route.pricing.status === "PRICING_NOT_APPROVED") {
        setPopup({kind:"RATE_PENDING",route});
      } else if(route.pricing.status === "QUOTABLE") {
        setPopup({kind:"QUOTE",route});
      } else {
        setPopup({kind:"UNAVAILABLE"});
      }
    } catch {
      setPopup({kind:"UNAVAILABLE"});
    } finally {
      setBusy(false);
    }
  }

  async function confirmRealtimePopup() {
    if(popup?.kind !== "QUOTE") return;
    const quoted = popup.route.pricing;
    setBusy(true);
    try {
      const response=await fetch("/api/realtime-window",{cache:"no-store"});
      if(!response.ok) {setPopup({kind:"UNAVAILABLE"});return;}
      const gate=await response.json();
      if(!gate.realtimeOpen) {setMode("BOOKING");setPopup({kind:"CLOSED"});return;}
      const age = Date.now()-Date.parse(quoted.requestAt);
      if(age<0 || age>90_000 || gate.baseFeeBaht !== quoted.baseFeeBaht) {
        setPopup(null);
        setBusy(false);
        await showRealtimePopup();
        return;
      }
    } catch {setPopup({kind:"UNAVAILABLE"});return;}
    finally {setBusy(false);}
    setPopup(null);
    await completeSubmission();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "IMMEDIATE") {
      await showRealtimePopup();
      return;
    }
    await completeSubmission();
  }

  async function completeSubmission() {
    setError("");
    setSuccess("");

    const supabase = getSupabase();
    if (!supabase) {
      setError("ระบบรับคำขอยังไม่พร้อมใช้งาน กรุณากลับมาตรวจสอบภายหลัง");
      return;
    }

    const paths: string[] = [];
    let submitted = false;
    const validatedTime = mode === "BOOKING" ? validateSchedule(scheduleDraft) : null;
    if (validatedTime && !validatedTime.ok) { setError(validatedTime.message); return; }
    if (mode === "BOOKING" && !(/^(1\d|2[01]):/.test(scheduleDraft.startTime) || /^(00|01):/.test(scheduleDraft.startTime))) {
      setError("เวลานัดหมายต้องอยู่ระหว่าง 10:00–01:59 น.");return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("กรุณาเข้าสู่ระบบก่อนส่งคำขอ หรือไปที่หน้าเข้าสู่ระบบ");
        return;
      }
      if (files.length > 4) throw new Error("แนบรูปได้ไม่เกิน 4 รูป");
      if (files.some((file) => !allowedTypes.has(file.type) || file.size > 5_000_000)) {
        throw new Error("รูปต้องเป็น JPG, PNG หรือ WebP และมีขนาดไม่เกิน 5 MB ต่อรูป");
      }

      if (values.service_address.trim().length < 15) throw new Error("กรุณากรอกที่อยู่บ้านหรือสถานที่นัดให้ครบถ้วน");
      const draft = booking.safeParse({ ...values, photo_paths: files.map(() => "pending") });
      if (!draft.success) {
        throw new Error(draft.error.issues.map((issue) => issue.message).join("; "));
      }

      const { error: enrollmentError } = await supabase.rpc("join_operating_tenant_as_customer");
      if (enrollmentError) throw new Error("ยังไม่สามารถลงทะเบียนลูกค้าในระบบได้ กรุณาติดต่อทีมงาน");
      for (const file of files) {
        const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("equipment-photos")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error("อัปโหลดรูปไม่สำเร็จ กรุณาลองใหม่");
        paths.push(path);
      }

      const parsed = booking.safeParse({ ...values, photo_paths: paths });
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((issue) => issue.message).join("; "));
      }

      const requestKey = idempotencyKey.current
        ?? window.sessionStorage.getItem(idempotencyStorageKey)
        ?? crypto.randomUUID();
      idempotencyKey.current = requestKey;
      window.sessionStorage.setItem(idempotencyStorageKey, requestKey);
      const { data, error: requestError } = await supabase.rpc("create_chang24_service_request", {
        p_category: parsed.data.category,
        p_fault_description: parsed.data.fault_description,
        p_brand: parsed.data.brand,
        p_model_number: parsed.data.model_number,
        p_district: values.district,
        p_service_address: values.service_address.trim(),
        p_latitude: locationConfirmed ? customerCoords?.latitude ?? null : null,
        p_longitude: locationConfirmed ? customerCoords?.longitude ?? null : null,
        p_contact_name: parsed.data.contact_name,
        p_contact_phone: parsed.data.contact_phone,
        p_photo_paths: parsed.data.photo_paths,
        p_consent: true,
        p_idempotency_key: requestKey,
        p_mode: mode,
        p_desired_start: validatedTime?.ok ? validatedTime.startIso : null,
        p_desired_end: validatedTime?.ok ? validatedTime.endIso : null,
      });
      if (requestError || !data) {
        if (requestError?.message.includes("NO_TECHNICIAN_AVAILABLE_SELECT_BOOKING") || requestError?.message.includes("OUTSIDE_IMMEDIATE_SERVICE_HOURS")) {
          setMode("BOOKING");
          throw new Error("ขณะนี้เรียกช่างเรียลไทม์ไม่ได้ กรุณาเลือกนัดหมายล่วงหน้า");
        }
        throw new Error("เรียกช่างหรือนัดหมายไม่สำเร็จ กรุณาตรวจสอบที่อยู่และลองใหม่");
      }
      submitted = true;
      window.sessionStorage.removeItem(idempotencyStorageKey);
      idempotencyKey.current = null;
      setSuccess(String(data));
    } catch (caught) {
      const cause = caught instanceof Error ? caught.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
      if (paths.length && !submitted) {
        const { error: cleanupError } = await supabase.storage.from("equipment-photos").remove(paths);
        setError(cleanupError
          ? `${cause} · เก็บกวาดรูปที่อัปโหลดไม่สำเร็จ โปรดแจ้งทีมงาน`
          : cause);
      } else {
        setError(cause);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <span className="section-kicker">DAY NERAMIT · SERVICE REQUEST</span>
      <h1>เรียกช่าง / นัดหมายช่าง</h1>
      <p className="muted">เรียกช่างแบบเรียลไทม์ 10:00–01:59 น. ตามเวลาไทย · 02:00–09:59 น. เลือกนัดหมาย (Booking) ได้ตลอด</p>
      {realtimeOpen === false && <p className="notice" role="status">ขณะนี้ปิดรับเรียกช่างเรียลไทม์ กรุณาเลือกนัดหมายล่วงหน้าแทน</p>}
      <div className="request-modes" role="group" aria-label="เลือกประเภทคำขอ">
        <button type="button" className={mode === "IMMEDIATE" ? "active" : ""} onClick={()=>{setMode("IMMEDIATE");resetIdempotencyKey();}}>เรียกช่างทันที</button>
        <button type="button" className={mode === "BOOKING" ? "active" : ""} onClick={()=>{setMode("BOOKING");resetIdempotencyKey();}}>นัดหมายล่วงหน้า</button>
      </div>
      <LiveAvailability compact category={values.category} area={values.area} onAreaChange={area=>update("area",area)} onCategoryChange={category=>update("category",category)}/>
      <p className="notice">เมื่อกดเรียกช่างหรือนัดหมาย ทีมงานจะตรวจสอบก่อนยืนยัน ช่างยังไม่ออกเดินทางจนกว่าจะตกลงรายละเอียด</p>
      {!configured && <p className="notice" role="status">ระบบรับคำขออยู่ระหว่างเตรียมเปิดให้บริการ ยังส่งคำขอไม่ได้ในขณะนี้</p>}
      <p className="notice">
        ต้องเข้าสู่ระบบก่อน · <Link href="/login">เข้าสู่ระบบ</Link> ·
        ทีมงานจะตรวจสอบก่อนยืนยันวันเวลา
      </p>
      <form className="card" onSubmit={submit}>
        <fieldset disabled={busy || !configured || Boolean(success)}>
          <legend>{mode === "IMMEDIATE" ? "ข้อมูลเรียกช่างตอนนี้" : "ข้อมูลนัดหมาย"}</legend>
          {mode === "BOOKING" && <div className="schedule-grid">
            <div className="field"><label htmlFor="booking-date">วันที่ต้องการ *</label><input id="booking-date" type="date" required value={scheduleDraft.date} onChange={e=>{setScheduleDraft(v=>({...v,date:e.target.value}));resetIdempotencyKey();}}/></div>
            <div className="field"><label htmlFor="booking-start">เวลาเริ่ม *</label><input id="booking-start" type="time" required value={scheduleDraft.startTime} onChange={e=>{setScheduleDraft(v=>({...v,startTime:e.target.value}));resetIdempotencyKey();}}/></div>
            <div className="field"><label htmlFor="booking-end">เวลาสิ้นสุดประมาณการ *</label><input id="booking-end" type="time" required value={scheduleDraft.endTime} onChange={e=>{setScheduleDraft(v=>({...v,endTime:e.target.value}));resetIdempotencyKey();}}/></div>
            <small>เลือกเวลาเริ่ม 10:00–01:59 น. ระบบรองรับงานที่สิ้นสุดวันถัดไป</small>
          </div>}
        <div className="field">
          <label htmlFor="category">หมวดอุปกรณ์</label>
          <select id="category" value={values.category} onChange={(event) => update("category", event.target.value)}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fault">อาการเสียอย่างละเอียด *</label>
          <textarea id="fault" required minLength={20} maxLength={4000} value={values.fault_description} onChange={(event) => update("fault_description", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="brand">ยี่ห้อ (ถ้าทราบ)</label>
          <input id="brand" maxLength={120} value={values.brand} onChange={(event) => update("brand", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="model">รุ่น (ถ้าทราบ)</label>
          <input id="model" maxLength={120} value={values.model_number} onChange={(event) => update("model_number", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="district">อำเภอที่ต้องการให้ช่างไป *</label>
          <select id="district" required value={values.district}
            onChange={(event) => { update("district", event.target.value as FormValues["district"]); setDistance(null); setLocationConfirmed(false); setCustomerCoords(null); }}>
            <option value="BANG_YAI">บางใหญ่</option>
            <option value="BANG_BUA_THONG">บางบัวทอง</option>
          </select>
          <small>ให้บริการหลักในบางใหญ่และบางบัวทอง หากอยู่นอกพื้นที่โปรดติดต่อทีมงานก่อน</small>
        </div>
        <div className="field">
          <label htmlFor="service-address">ที่อยู่ที่ต้องการให้ช่างไป *</label>
          <textarea id="service-address" required minLength={15} maxLength={600}
            placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน ตำบล จุดสังเกต และรหัสไปรษณีย์"
            value={values.service_address}
            onChange={event => { update("service_address", event.target.value); setDistance(null); setLocationConfirmed(false); setCustomerCoords(null); }}/>
          <small>สำนักงานช่าง: {dayNeramitBusiness.officeAddress} · <a href={dayNeramitBusiness.officeMapUrl} target="_blank" rel="noopener noreferrer">ดูตำแหน่งสำนักงานบน Google Maps</a></small>
        </div>
        <div className="card" style={{margin:"14px 0"}}>
          <strong>ตำแหน่งบ้านและระยะทาง</strong>
          <p className="muted">กดอนุญาตตำแหน่งจากอุปกรณ์เฉพาะเมื่อคุณอยู่ที่บ้านหรือสถานที่นัด หากไม่อยู่ที่นั่นให้กรอกที่อยู่ไว้ก่อนเพื่อให้ทีมงานตรวจสอบ</p>
          <button className="btn btn-outline" type="button" onClick={useMyLocation} disabled={checkingDistance}>
            {checkingDistance ? "กำลังตรวจระยะทาง…" : "ใช้ตำแหน่งปัจจุบันของฉัน"}
          </button>
          {customerCoords && <label style={{display:"block",marginTop:12}}>
            <input type="checkbox" checked={locationConfirmed} onChange={event=>{
              setLocationConfirmed(event.target.checked);
              setDistance(null);
              resetIdempotencyKey();
              if(event.target.checked && customerCoords) void requestRoute(customerCoords);
            }}/>
            {" "}ยืนยันว่าพิกัดนี้คือสถานที่ที่จะให้ช่างไป
          </label>}
          <p><button className="btn btn-outline" type="button" disabled={checkingDistance || values.service_address.trim().length < 15}
            onClick={previewAddressRoute}>
            {checkingDistance ? "กำลังคำนวณ…" : "คำนวณระยะทางจากที่อยู่ลูกค้า"}
          </button></p>
          {geoMessage && <p className="notice" role="status">{geoMessage}</p>}
          {distance && <div className="notice" role="status">
            <strong>สำนักงาน → บ้านลูกค้า</strong>
            <p>ระยะทางขับรถ: {(distance.distanceMeters/1000).toFixed(2)} กม. · เวลาเดินทางประมาณ {distance.durationMinutes} นาที</p>
            <p>หากออกจากสำนักงานตอน {new Date(distance.departureAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit"})} น.
             คาดว่าจะถึงประมาณ {new Date(distance.estimatedArrivalAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit"})} น.</p>
            <p>ส่วนเกิน 5 กม.: {(distance.pricing.extraMeters/1000).toFixed(2)} กม. · ค่าเดินทางเพิ่ม: {baht(distance.pricing.extraFeeBaht)} ·
              ยอดรวม: <strong>{baht(distance.pricing.totalBaht)}</strong></p>
            <small>ราคาช่วงกลางวัน/กลางคืนยึดเวลาที่ลูกค้ากดเรียกช่างและเซิร์ฟเวอร์รับรายการ ไม่ใช่เวลาเดินทางออกจากสำนักงาน</small>
          </div>}
          {(customerCoords || values.service_address.trim().length >= 15) && <p><button type="button" className="btn btn-outline" onClick={openDirections}>ดูเส้นทางและระยะทางบน Google Maps</button></p>}
          {!distance && <p className="muted">ยังไม่ยืนยันระยะทางตามถนนและค่าบริการ เจ้าหน้าที่จะตรวจสอบก่อนนัดหมายหรือออกเดินทาง</p>}
        </div>
        <div className="field">
          <label htmlFor="contact-name">ชื่อผู้ติดต่อ *</label>
          <input id="contact-name" required autoComplete="name" maxLength={120} value={values.contact_name} onChange={(event) => update("contact_name", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="contact-phone">เบอร์โทรศัพท์ *</label>
          <input id="contact-phone" required autoComplete="tel" inputMode="tel" maxLength={10} value={values.contact_phone} onChange={(event) => update("contact_phone", event.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="photos">รูปอุปกรณ์ (จำเป็นเมื่อไม่ทราบทั้งยี่ห้อและรุ่น)</label>
          <input id="photos" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { resetIdempotencyKey(); setFiles(Array.from(event.target.files ?? [])); }} />
          <small>สูงสุด 4 รูป ขนาดไม่เกิน 5 MB ต่อรูป (JPG, PNG หรือ WebP)</small>
        </div>
        <label>
          <input type="checkbox" checked={values.consent} onChange={(event) => update("consent", event.target.checked)} />
          {" "}ยินยอมให้ใช้ข้อมูลติดต่อ ที่อยู่ พิกัดตำแหน่งที่ฉันยืนยัน และรูปภาพเพื่อประสานงานกับช่าง
        </label>
        <p><button className="btn" type="submit" disabled={busy || !values.consent || Boolean(success)}>{busy ? "กำลังส่ง…" : mode === "IMMEDIATE" ? "เรียกช่าง" : "นัดหมายช่าง"}</button></p>
        </fieldset>
        {error && <div className="error" role="alert">{error}</div>}
        {success && <div className="ok" role="status">ส่งเรื่องถึงทีมช่างแล้ว: {success}<p>สถานะ: รอทีมงานตรวจสอบ — ยังไม่ใช่การยืนยันการออกเดินทางหรือนัดหมาย <Link href="/my-bookings">ดูการเรียกช่างและนัดหมายของฉัน →</Link></p></div>}
      </form>
      <ServiceTerms />
      {popup && <div role="presentation" style={{position:"fixed",inset:0,background:"rgba(0,0,0,.78)",zIndex:1000,display:"grid",placeItems:"center",padding:16}}>
        <section role="dialog" aria-modal="true" aria-labelledby="realtime-confirm-title"
          style={{background:"#161616",color:"#fff",border:"1px solid #d7b56d",borderRadius:16,maxWidth:480,width:"100%",maxHeight:"90vh",overflowY:"auto",padding:24,boxShadow:"0 25px 65px #000c"}}>
          <h2 id="realtime-confirm-title">{popup.kind === "CLOSED" ? "ขณะนี้ปิดรับเรียกช่างทันที" : "ตรวจสอบค่าบริการเรียกช่าง"}</h2>
          {popup.kind==="CLOSED" ? <p>ช่วง 02:00–09:59 น. ไม่เปิดรับเรียกช่างแบบเรียลไทม์ กรุณาเลือกวันและเวลานัดหมายแทน โดยนัดหมายล่วงหน้าได้ตลอด 24 ชั่วโมง</p>
          : popup.kind==="UNAVAILABLE" ? <p>ยังตรวจสอบเส้นทางและค่าบริการอัตโนมัติไม่ได้ จึงไม่สามารถยืนยันยอดเรียกช่างได้ตอนนี้ กรุณาเลือกนัดหมายล่วงหน้าเพื่อให้ทีมงานตรวจสอบ</p>
          : "route" in popup ? <>
            <p>คำนวณจากสำนักงานไปบ้านลูกค้า ตามเส้นทางขับรถจริง</p>
            <dl style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"8px 16px",margin:"16px 0"}}>
              <dt>ระยะทางรวม</dt><dd>{(popup.route.distanceMeters/1000).toFixed(2)} กม.</dd>
              <dt>ระยะเกิน 5 กม.</dt><dd>{(popup.route.pricing.extraMeters/1000).toFixed(2)} กม.</dd>
              <dt>ค่าออกตรวจตามเวลากดเรียก</dt><dd>{baht(popup.route.pricing.baseFeeBaht)}</dd>
              <dt>ค่าเดินทางส่วนเพิ่ม</dt><dd>{baht(popup.route.pricing.extraFeeBaht)}</dd>
              <dt><strong>ยอดรวม</strong></dt><dd><strong>{baht(popup.route.pricing.totalBaht)}</strong></dd>
            </dl>
            <p>เวลาขับรถประมาณ {popup.route.durationMinutes} นาที · เวลาเรียกที่ประเมิน {new Date(popup.route.pricing.requestAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit"})} น.</p>
            {popup.kind==="RATE_PENDING" && <p role="alert">ระยะทางเกิน 5 กม. แต่ยังไม่ได้อนุมัติอัตราคิดเงินต่อกิโลเมตรหรือการปัดเศษ จึงไม่สามารถแสดงยอดรวมที่ถูกต้องได้ กรุณานัดหมายให้ทีมงานตรวจสอบ</p>}
            <p style={{fontSize:13,opacity:.85}}>ราคานี้เป็นยอดประมาณการที่ลูกค้าต้องตรวจสอบก่อนยืนยัน ไม่ใช่ยืนยันว่ามีช่างออกเดินทางหรือมีการเรียกเก็บเงินแล้ว</p>
          </> : null}
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:20}}>
            {popup.kind==="QUOTE" && <button type="button" autoFocus className="btn btn-gold" disabled={busy}
              onClick={()=>void confirmRealtimePopup()}>{busy?"กำลังตรวจสอบ…":"ยืนยันเรียกช่างตามยอดที่แสดง"}</button>}
            <button type="button" className="btn btn-outline" onClick={()=>{setPopup(null);setMode("BOOKING");resetIdempotencyKey();}}>นัดหมายล่วงหน้า (Booking)</button>
            <button type="button" className="btn btn-outline" onClick={()=>setPopup(null)}>ปิด</button>
          </div>
        </section>
      </div>}
    </section>
  );
}
