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
  const [distance, setDistance] = useState<{distanceMeters:number;estimateStatus:string;estimateFeeBaht:number|null}|null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  function resetIdempotencyKey() {
    idempotencyKey.current = null;
    window.sessionStorage.removeItem(idempotencyStorageKey);
    setSuccess("");
  }

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    resetIdempotencyKey();
    setValues((current) => ({ ...current, [key]: value }));
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
      const supabase = getSupabase();
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      if (!session) {
        setGeoMessage("ได้รับพิกัดแล้ว กรุณาเข้าสู่ระบบก่อนตรวจระยะทาง หรือให้เจ้าหน้าที่ตรวจสอบภายหลัง");
        setCheckingDistance(false);
        return;
      }
      try {
        const response = await fetch("/api/route-distance", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(point),
          cache: "no-store",
        });
        const result = await response.json();
        if (response.ok && typeof result.distanceMeters === "number") {
          setDistance(result);
        } else {
          setGeoMessage("ได้รับพิกัดแล้ว แต่ยังคำนวณระยะทางจริงไม่ได้ กรุณายืนยันที่อยู่เพื่อรอเจ้าหน้าที่ตรวจสอบ");
        }
      } catch {
        setGeoMessage("ได้รับพิกัดแล้ว แต่บริการคำนวณเส้นทางไม่พร้อมใช้งาน");
      } finally {
        setCheckingDistance(false);
      }
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
          throw new Error("ขณะนี้เรียกช่างทันทีไม่ได้ กรุณาเลือกวันและเวลา Booking ล่วงหน้า");
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
      <p className="muted">เรียกทันทีในช่วง 10:00–02:00 น. เมื่อช่างพร้อม · จองวันและเวลาอื่นได้ตลอด 24 ชั่วโมง</p>
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
            <input type="checkbox" checked={locationConfirmed} onChange={event=>{setLocationConfirmed(event.target.checked);resetIdempotencyKey();}}/>
            {" "}ยืนยันว่าพิกัดนี้คือสถานที่ที่จะให้ช่างไป
          </label>}
          {geoMessage && <p className="notice" role="status">{geoMessage}</p>}
          {distance && <div className="notice" role="status">
            ระยะทางขับรถจากสำนักงานโดยประมาณ: {(distance.distanceMeters / 1000).toFixed(2)} กม.
            <p>{mode === "BOOKING"
              ? "ค่าออกตรวจจะขึ้นอยู่กับเวลาที่ลูกค้ายืนยันเรียกช่างและฐานช่างที่ได้รับมอบหมาย"
              : distance.estimateStatus === "EXCESS_DISTANCE_REVIEW"
              ? "เกิน 5 กม. ต้องรอทีมงานตรวจสอบค่าเดินทาง"
              : distance.estimateStatus === "ESTIMATE"
                ? `ค่าออกตรวจเบื้องต้น ${distance.estimateFeeBaht} บาท (ยังไม่ใช่ราคาที่อนุมัติ)`
                : "ยังไม่สามารถยืนยันราคาได้"}</p>
            <small>เส้นทางจากสำนักงานเป็นข้อมูลเบื้องต้น หากช่างออกจากฐานอื่น ต้องตรวจสอบระยะทางใหม่ก่อนยืนยันราคา</small>
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
    </section>
  );
}
