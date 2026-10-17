"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { validateSchedule, type ScheduleDraft } from "@/lib/schedule";
import { LiveAvailability } from "@/components/live-availability";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import { booking } from "@/lib/validation";
import { ServiceTerms } from "@/components/service-terms";

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
    const area = query.get("area");
    setValues(current => ({...current,
      category: category && categories.some(([key]) => key === category) ? category : current.category,
      area: area === "BANGKOK" || area === "NONTHABURI" ? area : current.area,
    }));
  }, []);
  const [values, setValues] = useState<FormValues>({
    category: "OTHER",
    fault_description: "",
    brand: "",
    model_number: "",
    area: "NONTHABURI",
    contact_name: "",
    contact_phone: "",
    consent: false,
  });
  const [files, setFiles] = useState<File[]>([]);
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
      const { data, error: requestError } = await supabase.rpc("create_service_request", {
        p_category: parsed.data.category,
        p_fault_description: parsed.data.fault_description,
        p_brand: parsed.data.brand,
        p_model_number: parsed.data.model_number,
        p_area: parsed.data.area,
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
        throw new Error("บันทึกคำขอไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่");
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
      <h1>เรียกช่างทันที / Booking ล่วงหน้า</h1>
      <p className="muted">เรียกทันทีในช่วง 10:00–02:00 น. เมื่อช่างพร้อม · จองวันและเวลาอื่นได้ตลอด 24 ชั่วโมง</p>
      <div className="request-modes" role="group" aria-label="เลือกประเภทคำขอ">
        <button type="button" className={mode === "IMMEDIATE" ? "active" : ""} onClick={()=>{setMode("IMMEDIATE");resetIdempotencyKey();}}>เรียกช่างทันที</button>
        <button type="button" className={mode === "BOOKING" ? "active" : ""} onClick={()=>{setMode("BOOKING");resetIdempotencyKey();}}>Booking ล่วงหน้า 24 ชั่วโมง</button>
      </div>
      <LiveAvailability compact category={values.category} area={values.area} onAreaChange={area=>update("area",area)} onCategoryChange={category=>update("category",category)}/>
      <p className="notice">การส่งคำขอยังไม่ใช่การยืนยันมีช่างออกเดินทาง ทีมงานต้องตรวจสอบและช่างต้องรับงานก่อน</p>
      {!configured && <p className="notice" role="status">ระบบรับคำขออยู่ระหว่างเตรียมเปิดให้บริการ ยังส่งคำขอไม่ได้ในขณะนี้</p>}
      <p className="notice">
        ต้องเข้าสู่ระบบก่อน · <Link href="/login">เข้าสู่ระบบ</Link> ·
        ทุกคำขอรอเจ้าหน้าที่ตรวจสอบก่อนยืนยันนัดหมาย
      </p>
      <form className="card" onSubmit={submit}>
        <fieldset disabled={busy || !configured || Boolean(success)}>
          <legend>{mode === "IMMEDIATE" ? "ข้อมูลเรียกช่างตอนนี้" : "ข้อมูล Booking ล่วงหน้า"}</legend>
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
          <label htmlFor="area">พื้นที่</label>
          <select id="area" value={values.area} onChange={(event) => update("area", event.target.value as FormValues["area"])}>
            <option value="NONTHABURI">นนทบุรี</option>
            <option value="BANGKOK">กรุงเทพมหานคร</option>
          </select>
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
          {" "}ยินยอมให้ใช้ข้อมูลติดต่อและรูปภาพเพื่อดำเนินการตามคำขอนี้
        </label>
        <p><button className="btn" type="submit" disabled={busy || !values.consent || Boolean(success)}>{busy ? "กำลังส่ง…" : "ส่งคำขอ"}</button></p>
        </fieldset>
        {error && <div className="error" role="alert">{error}</div>}
        {success && <div className="ok" role="status">รับคำขอแล้ว: {success}<p>สถานะ: รอทีมงานตรวจสอบ — ยังไม่ใช่การยืนยันการออกเดินทางหรือนัดหมาย <Link href="/my-bookings">ดูรายการจองของฉัน →</Link></p></div>}
      </form>
      <ServiceTerms />
    </section>
  );
}
