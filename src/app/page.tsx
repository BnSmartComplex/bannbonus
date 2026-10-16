import Link from "next/link";
import { ServiceTerms } from "@/components/service-terms";
import { ArrowRight, ShieldCheck, Wrench } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3 font-bold"><span className="rounded-xl bg-blue-950 p-3 text-white"><Wrench aria-hidden="true" size={22}/></span>BannBonus</div>
        <span className="text-sm text-slate-600">กรุงเทพฯ และนนทบุรี</span>
      </header>
      <section className="mx-auto grid min-h-[70vh] max-w-6xl content-center gap-8 px-6 py-16">
        <span className="w-fit rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">BNSmart · Field Service Platform</span>
        <h1 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">ประสานงานช่างรับเหมาอิสระ <span className="text-blue-700">ทีมงานตรวจสอบก่อนยืนยันบริการ</span></h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-600">รับงานเรียกช่างใหม่ทุกวัน 10:00–02:00 น. ของวันถัดไป ส่งคำขอ Booking ล่วงหน้าได้ฟรีตลอดเวลา เจ้าหน้าที่ตรวจสอบก่อนยืนยันนัด</p>
        <div className="flex flex-wrap items-center gap-4"><Link className="inline-flex items-center gap-2 rounded-xl bg-blue-950 px-6 py-4 font-semibold text-white" href="/booking"><ArrowRight aria-hidden="true" size={20}/> ส่งคำขอ Booking ล่วงหน้า</Link><Link className="text-sm font-semibold" href="/my-bookings">ดูคำขอของฉัน</Link><span className="inline-flex items-center gap-2 text-sm text-slate-600"><ShieldCheck aria-hidden="true" size={20}/> ทุกคำขอรอทีมงานยืนยัน</span></div>
        <p className="mt-8 rounded-xl bg-blue-50 p-4 text-sm leading-relaxed text-slate-700">เว็บไซต์อยู่ระหว่างทดสอบ ยังไม่เปิดให้จองบริการจริง</p>
        <ServiceTerms />
      </section>
    </main>
  );
}
