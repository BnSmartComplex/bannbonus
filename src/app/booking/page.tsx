"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateBookingStart } from "@/lib/schedule";
import { LiveAvailability } from "@/components/live-availability";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { booking } from "@/lib/validation";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";
import { CustomerRoadMap, type RoadGeometry } from "@/components/customer-road-map";
import { ExternalLink, MapPin, Pencil } from "lucide-react";

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
  billableExtraKilometres: number;
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
  geometry: RoadGeometry;
  roadSteps: Array<{instructionTh:string;roadName:string|null;distanceMeters:number}>;
  provider: "OPENROUTESERVICE_OSM";
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
  district: "" | "BANG_YAI" | "BANG_BUA_THONG";
  service_address: string;
  contact_name: string;
  contact_phone: string;
  consent: boolean;
};

export default function BookingPage() {
  const configured = Boolean(getSupabase());
  const [mode, setMode] = useState<"IMMEDIATE"|"BOOKING">("BOOKING");
  const [scheduleDraft, setScheduleDraft] = useState({date:"",startTime:""});
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
    district: "",
    service_address: "",
    contact_name: "",
    contact_phone: "",
    consent: false,
  });
  const [files, setFiles] = useState<File[]>([]);
  const [customerCoords, setCustomerCoords] = useState<{latitude:number;longitude:number}|null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");
  const [checkingDistance, setCheckingDistance] = useState(false);
  const [distance, setDistance] = useState<RouteQuote | null>(null);
  const [popup, setPopup] = useState<PricePopup | null>(null);
  const [realtimeOpen, setRealtimeOpen] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const addressField = useRef<HTMLTextAreaElement | null>(null);
  const locationLookupId = useRef(0);

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
      setPopup(null);
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

  async function requestRoute(destination: { latitude:number; longitude:number }) {
    setCheckingDistance(true);
    setDistance(null);
    const supabase = getSupabase();
    const { data: { session } } = supabase
      ? await supabase.auth.getSession()
      : { data: { session: null } };
    if (!session) {
      setGeoMessage("กรุณาเข้าสู่ระบบก่อนดูระยะทางตามถนน หรือดูแผนที่ OpenStreetMap ได้");
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
        setGeoMessage("ยังคำนวณระยะทางตามถนนไม่ได้ กรุณานัดหมายเพื่อให้ทีมงานตรวจสอบ");
      }
    } catch {
      setGeoMessage("บริการคำนวณเส้นทางขัดข้อง กรุณาให้ทีมงานตรวจสอบ");
    } finally {
      setCheckingDistance(false);
    }
  }

  function previewPinnedRoute() {
    if (!customerCoords || !locationConfirmed) {
      setGeoMessage("กรุณาปักหมุดบ้านบนแผนที่ แล้วติ๊กยืนยันตำแหน่งก่อนคำนวณ");
      return;
    }
    void requestRoute(customerCoords);
  }

  function selectOnMap(point: {latitude:number;longitude:number}) {
    locationLookupId.current += 1;
    setCustomerCoords(point);
    setLocationConfirmed(false);
    setDistance(null);
    setCheckingDistance(false);
    setGeoMessage("ปักหมุดแล้ว โปรดกรอกที่อยู่ให้ครบ ตรวจสอบจุดนัดบนแผนที่ แล้วกดยืนยัน");
    resetIdempotencyKey();
  }

  function fullServiceAddress() {
    const district=values.district==="BANG_YAI"?"บางใหญ่":"บางบัวทอง";
    const address=values.service_address.trim();
    const parts=[address];
    if (!address.includes(district)) parts.push(`อำเภอ${district}`);
    if (!/นนทบุรี|Nonthaburi/i.test(address)) parts.push("จังหวัดนนทบุรี");
    return parts.filter(Boolean).join(" ");
  }

  function useMyLocation() {
    const requestId = ++locationLookupId.current;
    setDistance(null);
    setGeoMessage("");
    setLocationConfirmed(false);
    setCustomerCoords(null);
    if (!navigator.geolocation) {
      setGeoMessage("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง กรุณากรอกที่อยู่เพื่อให้เจ้าหน้าที่ตรวจสอบ");
      return;
    }
    setCheckingDistance(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      if (requestId !== locationLookupId.current) return;
      const point = { latitude: coords.latitude, longitude: coords.longitude };
      setCustomerCoords(point);
      resetIdempotencyKey();
      setGeoMessage("ได้รับพิกัดแล้ว โปรดเปิดแผนที่ตรวจสอบจุดนัด กรอกที่อยู่ให้ครบ แล้วกดยืนยัน");
      setCheckingDistance(false);
    }, () => {
      if (requestId !== locationLookupId.current) return;
      locationLookupId.current += 1;
      setCustomerCoords(null);
      setGeoMessage("ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง กรุณากรอกที่อยู่ให้ครบเพื่อให้เจ้าหน้าที่ตรวจสอบ");
      setCheckingDistance(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 });
  }

  function openDirections() {
    if (!customerCoords) return;
    const origin=dayNeramitBusiness.officeCoordinates;
    const route=encodeURIComponent(`${origin.latitude},${origin.longitude};${customerCoords.latitude},${customerCoords.longitude}`);
    window.open(`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${route}`,"_blank","noopener,noreferrer");
  }

  async function showRealtimePopup() {
    setError("");
    if (values.service_address.trim().length < 15) {
      setError("กรุณากรอกที่อยู่บ้านหรือจุดนัดหมายให้ครบก่อนเรียกช่าง");
      return;
    }
    if (!values.district) {
      setError("กรุณาเลือกพื้นที่ให้บริการให้ตรงกับจุดหมาย");
      return;
    }
    if (!customerCoords || !locationConfirmed) {
      setError("กรุณาปักหมุดตำแหน่งบ้านลูกค้าและยืนยันหมุดบนแผนที่ก่อนเรียกช่างทันที");
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
      const destination = customerCoords;
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
    const validatedTime = mode === "BOOKING" ? validateBookingStart(scheduleDraft.date, scheduleDraft.startTime) : null;
    if (validatedTime && !validatedTime.ok) { setError(validatedTime.message); return; }
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

      if (values.service_address.trim().length < 15) throw new Error("กรุณากรอกที่อยู่หรือจุดสังเกตให้ช่างหาสถานที่ได้");
      if (!values.district) throw new Error("กรุณาเลือกพื้นที่ให้บริการให้ตรงกับจุดหมาย");
      const confirmedAddress=fullServiceAddress();
      if (confirmedAddress.length > 600) throw new Error("ที่อยู่ยาวเกิน 600 ตัวอักษร กรุณาย่อรายละเอียด");
      if (mode==="IMMEDIATE" && (!locationConfirmed || !customerCoords)) throw new Error("เรียกช่างทันทีต้องยืนยันหมุดบ้านก่อน");
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
        p_service_address: confirmedAddress,
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
        throw new Error("ดำเนินการไม่สำเร็จ กรุณาตรวจสอบที่อยู่และลองใหม่");
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
      <h1 className="booking-title">{mode === "IMMEDIATE" ? "เรียกช่าง" : "นัดหมาย"}</h1>
      <p className="booking-intro">แจ้งรายละเอียดงานและที่อยู่ ทีมงานจะยืนยันก่อนส่งช่าง</p>
      <div className="request-modes" role="group" aria-label="เลือกบริการ">
        <button type="button" disabled={realtimeOpen === false}
          aria-pressed={mode === "IMMEDIATE"} className={mode === "IMMEDIATE" ? "active" : ""}
          onClick={()=>{setMode("IMMEDIATE");resetIdempotencyKey();}}>เรียกช่าง</button>
        <button type="button" aria-pressed={mode === "BOOKING"}
          className={mode === "BOOKING" ? "active" : ""}
          onClick={()=>{setMode("BOOKING");resetIdempotencyKey();}}>นัดหมาย</button>
      </div>
      <p className="booking-availability-note">
        {realtimeOpen === false
          ? "ขณะนี้รับเฉพาะนัดหมาย · เรียกช่างได้อีกครั้งตั้งแต่ 10:00 น."
          : "เรียกช่างได้ 10:00–02:00 น. · นัดหมายล่วงหน้าได้ทุกเวลา"}
      </p>
      {mode === "IMMEDIATE" && realtimeOpen !== false && <details className="compact-availability">
        <summary>ดูสถานะช่างในพื้นที่</summary>
        <LiveAvailability compact category={values.category} area={values.area}
          onAreaChange={area=>update("area",area)} onCategoryChange={category=>update("category",category)}/>
      </details>}
      {!configured && <p className="notice" role="status">ระบบยังไม่พร้อมรับงาน กรุณาติดต่อทีมงาน</p>}
      <form className="card" onSubmit={submit}>
        <fieldset disabled={busy || !configured || Boolean(success)}>
          <legend>รายละเอียดงาน</legend>
          {mode === "BOOKING" && <div className="schedule-grid">
            <div className="field"><label htmlFor="booking-date">วันที่ต้องการ *</label><input id="booking-date" type="date" required value={scheduleDraft.date} onChange={e=>{setScheduleDraft(v=>({...v,date:e.target.value}));resetIdempotencyKey();}}/></div>
            <div className="field"><label htmlFor="booking-start">เวลาเริ่ม *</label><input id="booking-start" type="time" min="10:00" max="19:00" required value={scheduleDraft.startTime} onChange={e=>{setScheduleDraft(v=>({...v,startTime:e.target.value}));resetIdempotencyKey();}}/></div>
            <small>เลือกเวลาเริ่ม 10:00–19:00 น. เจ้าหน้าที่จะยืนยันช่วงนัดอีกครั้ง</small>
          </div>}
        <div className="field">
          <label htmlFor="category">ประเภทงาน</label>
          <select id="category" value={values.category} onChange={(event) => update("category", event.target.value)}>
            {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="fault">อาการเสียหรือรายละเอียดงาน *</label>
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
          <label htmlFor="district">พื้นที่ให้บริการ *</label>
          <select id="district" required value={values.district}
            onChange={(event) => { update("district", event.target.value as FormValues["district"]); setDistance(null); setLocationConfirmed(false); }}>
            <option value="" disabled>เลือกพื้นที่</option>
            <option value="BANG_YAI">บางใหญ่</option>
            <option value="BANG_BUA_THONG">บางบัวทอง</option>
          </select>
          <small>เลือกบางใหญ่หรือบางบัวทองให้ตรงกับจุดหมาย หากอยู่นอกพื้นที่โปรดติดต่อทีมงานก่อน</small>
        </div>
        <div className="field">
          <label htmlFor="service-address">ที่อยู่หรือจุดสังเกตที่ต้องการให้ช่างไป *</label>
          <textarea id="service-address" ref={addressField} required minLength={15} maxLength={600}
            placeholder="บ้านเลขที่ หมู่บ้าน ซอย ถนน ตำบล หรือจุดสังเกตใกล้บ้าน"
            value={values.service_address}
            onChange={event => { update("service_address", event.target.value); setDistance(null); setLocationConfirmed(false); }}/>
          <small>กรอกข้อมูลที่ช่างใช้หาบ้านได้จริง ไม่ต้องแยกตำบล หมู่ที่ หรือซอยหลายช่อง</small>
        </div>
        <div className="field booking-location">
          <label>ตำแหน่งที่ต้องการให้ช่างไป</label>
          <p className="muted">เมื่ออยู่ที่สถานที่นัด ใช้ GPS ได้ หรือเลือกจุดบนแผนที่หากอยู่ที่อื่น โปรดตรวจสอบพิกัดและกรอกที่อยู่ให้ครบ</p>
          <div className="booking-location-actions">
            <button className="btn btn-outline" type="button" onClick={useMyLocation} disabled={checkingDistance}>
              <MapPin size={17}/>{checkingDistance ? "กำลังหาตำแหน่ง…" : "ใช้ GPS ปัจจุบัน"}
            </button>
            <button className="btn btn-outline" type="button" aria-expanded={showMap}
              onClick={()=>setShowMap(current=>!current)}><MapPin size={17}/>{showMap ? "ซ่อนแผนที่" : "ปักหมุดบนแผนที่"}</button>
          </div>
          {showMap && <CustomerRoadMap point={customerCoords} route={distance?.geometry??null}
            onPick={selectOnMap}/>}
          {customerCoords && <div className="booking-location-result">
            <strong>ตำแหน่งที่เลือก</strong>
            <p className="booking-location-coordinates">{customerCoords.latitude.toFixed(6)}, {customerCoords.longitude.toFixed(6)}</p>
            <a className="inline-link" href={`https://www.google.com/maps/search/?api=1&query=${customerCoords.latitude}%2C${customerCoords.longitude}`}
              target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>เปิดพิกัดบนแผนที่</a>
            <div className="booking-location-actions">
              <button className="btn btn-outline" type="button" onClick={() => addressField.current?.focus()}>
                <Pencil size={16}/>แก้ไขที่อยู่
              </button>
            </div>
          </div>}
          {customerCoords && <label className="booking-location-confirm">
            <input type="checkbox" checked={locationConfirmed} disabled={checkingDistance} onChange={event=>{
              if (event.target.checked && (values.service_address.trim().length < 15 || !values.district)) {
                setGeoMessage("กรุณาตรวจสอบและกรอกที่อยู่ พร้อมเลือกพื้นที่ให้บริการก่อนยืนยันพิกัด");
                return;
              }
              setLocationConfirmed(event.target.checked);
              setDistance(null);
              resetIdempotencyKey();
              if(mode === "IMMEDIATE" && event.target.checked && customerCoords) void requestRoute(customerCoords);
            }}/>
            {" "}ยืนยันว่าที่อยู่และพิกัดนี้คือสถานที่ที่จะให้ช่างไป
          </label>}
          {geoMessage && <p className="notice" role="status">{geoMessage}</p>}
          {mode === "IMMEDIATE" && <p><button className="btn btn-outline" type="button" disabled={checkingDistance || !customerCoords || !locationConfirmed}
            onClick={previewPinnedRoute}>
            {checkingDistance ? "กำลังคำนวณ…" : "คำนวณเส้นทางขับรถจากหมุดบ้านลูกค้า"}
          </button></p>}
          {mode === "IMMEDIATE" && distance && <div className="notice" role="status">
            <strong>สำนักงาน → บ้านลูกค้า</strong>
            <p>ระยะทางขับรถ: {(distance.distanceMeters/1000).toFixed(2)} กม. · เวลาเดินทางประมาณ {distance.durationMinutes} นาที (ไม่ได้ใช้ข้อมูลจราจรสด)</p>
            <p>หากออกจากสำนักงานตอน {new Date(distance.departureAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit"})} น.
             คาดว่าจะถึงประมาณ {new Date(distance.estimatedArrivalAt).toLocaleString("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit"})} น.</p>
            <p>ส่วนเกิน 5 กม.: {(distance.pricing.extraMeters/1000).toFixed(2)} กม. (คิดเงิน {distance.pricing.billableExtraKilometres} กม. × {distance.approvedExcessRateBahtPerKm} บาท) · ค่าเดินทางเพิ่ม: {baht(distance.pricing.extraFeeBaht)} ·
              ยอดรวม: <strong>{baht(distance.pricing.totalBaht)}</strong></p>
            <small>ราคาช่วงกลางวัน/กลางคืนยึดเวลาที่ลูกค้ากดเรียกช่างและเซิร์ฟเวอร์รับรายการ ไม่ใช่เวลาเดินทางออกจากสำนักงาน</small>
          </div>}
          {mode === "IMMEDIATE" && customerCoords && <p><button type="button" className="btn btn-outline" onClick={openDirections}>ดูเส้นทางบน OpenStreetMap</button></p>}
          {mode === "IMMEDIATE" && distance?.roadSteps?.length ? <details><summary>รายละเอียดเส้นทางและชื่อถนน / ซอย</summary>
            <ol>{distance.roadSteps.map((step,index)=><li key={index}>{step.instructionTh} {step.distanceMeters>0?`(${(step.distanceMeters/1000).toFixed(2)} กม.)`:""}</li>)}</ol>
            <small>ข้อความเลี้ยวแสดงภาษาไทย ชื่อถนน/ซอยจากข้อมูล OpenStreetMap อาจไม่ครบ โปรดดูแผนที่ประกอบ</small>
          </details>:null}
          {mode === "IMMEDIATE" && !distance && <p className="muted">หากยังไม่แสดงระยะทางจากเส้นทางรถจริง จะยังไม่ยืนยันราคา เจ้าหน้าที่ต้องตรวจสอบก่อนออกเดินทาง</p>}
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
          {" "}ยินยอมให้ใช้ข้อมูลที่ให้ไว้เพื่อประสานงานกับช่าง
        </label>
        <div className="booking-submit">
          <button className="btn btn-gold" type="submit" disabled={busy || !values.consent || Boolean(success)}>
            {busy ? "กำลังส่ง…" : mode === "IMMEDIATE" ? "ดูราคาและยืนยันเรียกช่าง" : "ส่งนัดหมาย"}
          </button>
          <small>ก่อนส่งช่าง เจ้าหน้าที่จะยืนยันรายละเอียดและค่าใช้จ่าย</small>
        </div>
        </fieldset>
        {error && <div className="error" role="alert">{error}</div>}
        {success && <div className="ok" role="status">ส่งเรื่องถึงทีมช่างแล้ว: {success}<p>สถานะ: รอทีมงานตรวจสอบ — ยังไม่ใช่การยืนยันการออกเดินทางหรือนัดหมาย <Link href="/my-bookings">ติดตามงาน →</Link></p></div>}
      </form>
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
              <dt>ระยะที่คิดเงินเพิ่ม (ปัดขึ้น)</dt><dd>{popup.route.pricing.billableExtraKilometres} กม.</dd>
              <dt>อัตราส่วนเกิน</dt><dd>{popup.route.approvedExcessRateBahtPerKm} บาท/กม. (ปัดขึ้น)</dd>
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
            <button type="button" className="btn btn-outline" onClick={()=>{setPopup(null);setMode("BOOKING");resetIdempotencyKey();}}>นัดหมาย</button>
            <button type="button" className="btn btn-outline" onClick={()=>setPopup(null)}>ปิด</button>
          </div>
        </section>
      </div>}
    </section>
  );
}
