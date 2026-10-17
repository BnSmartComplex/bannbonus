import Link from "next/link";
import { ArrowUpRight, Clock3, ShieldCheck, Wind, Wrench, Waves, PlugZap, Refrigerator, WashingMachine, Laptop, PhoneCall, CalendarClock, ArrowRight } from "lucide-react";
import { LiveAvailability } from "@/components/live-availability";
import { dayNeramitBusiness } from "@/lib/day-neramit-business";
import { portalMode } from "@/lib/portal-mode";
import { StaffPortalHome } from "@/components/staff-portal-home";

const servicePhotos: Record<string,string> = {
 AIR_CONDITIONER:"aircon-repair-800.webp",
 ELECTRICAL:"electrical-800.webp",
 PLUMBING:"plumbing-800.webp",
 REFRIGERATOR:"https://images.unsplash.com/photo-1721521999887-5d0565a4f9da?auto=format&fit=crop&crop=entropy&w=900&q=85",
 WASHING_MACHINE:"washing-800.webp",
 ELECTRONICS:"computer-800.webp",
 OTHER:"general-repairs-800.webp",
};
const services = [
  { name: "เครื่องปรับอากาศ", description: "ล้าง ตรวจซ่อม ติดตั้งและย้ายแอร์", Icon: Wind, category: "AIR_CONDITIONER" },
  { name: "ไฟฟ้าภายในบ้าน", description: "ตรวจอาการและงานระบบไฟฟ้า", Icon: PlugZap, category: "ELECTRICAL" },
  { name: "งานประปา", description: "ท่อน้ำ ก๊อก สุขภัณฑ์และระบบน้ำ", Icon: Waves, category: "PLUMBING" },
  { name: "ตู้เย็น", description: "ตรวจและซ่อมระบบทำความเย็น", Icon: Refrigerator, category: "REFRIGERATOR" },
  { name: "เครื่องซักผ้า", description: "ตรวจซ่อมการทำงานและอาการเสีย", Icon: WashingMachine, category: "WASHING_MACHINE" },
  { name: "คอมพิวเตอร์ / อิเล็กทรอนิกส์", description: "อุปกรณ์ไฟฟ้าและเทคโนโลยี", Icon: Laptop, category: "ELECTRONICS" },
  { name: "ซ่อมบ้านและงานช่างอื่น ๆ", description: "สอบถามรายละเอียดงานทุกประเภท", Icon: Wrench, category: "OTHER" },
];

export default function HomePage() {
  if (portalMode() === "STAFF") return <StaffPortalHome />;
  return (
    <>
      <section className="gold-hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <div className="eyebrow"><span className="gold-dot" /> {dayNeramitBusiness.primaryServiceArea}</div>
          <div className="hero-logo" aria-label="Day Neramit">
            <img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3Jbrjw1A1wOVLHTuEgAgHqYVg57/e7bc55fe-d06b-4d14-ae26-d75e6f59753c.jpg" width="116" height="106" alt="โลโก้ Day Neramit" />
            <div><span className="overline">DAY NERAMIT</span><h1 id="hero-title">ช่างเดย์<span>เนรมิตร</span></h1><div className="hero-mini">SMART REPAIR &amp; RENOVATION</div></div>
          </div>
          <h2>เรื่องบ้านให้เราดูแล <em>ช่างใกล้บ้าน</em> ดูแลครบ</h2>
          <p className="hero-lead">ซ่อมแซม ติดตั้ง และดูแลบ้านในบางใหญ่–บางบัวทอง เลือกวันและเวลาที่สะดวก พร้อมติดตามสถานะงาน</p>
          <div className="hero-actions"><Link className="btn btn-gold" href="/booking?mode=IMMEDIATE">เรียกช่าง <ArrowUpRight size={19} /></Link><Link className="btn btn-outline" href="/booking?mode=BOOKING">นัดหมาย <CalendarClock size={19}/></Link></div>
          <div className="hero-quick"><span><Clock3 size={17}/> เรียกช่าง 10:00–02:00 น.</span><span><ShieldCheck size={17}/> นัดหมายได้ตลอด 24 ชม.</span></div>
        </div>
        <div className="hero-aside"><div className="hero-art"><div className="hero-circuit" /><img src="https://d2ol7oe51mr4n9.cloudfront.net/user_3Jbrjw1A1wOVLHTuEgAgHqYVg57/e7bc55fe-d06b-4d14-ae26-d75e6f59753c.jpg" alt="" aria-hidden="true" width="300" height="272" /><p>ช่างเดย์เนรมิตร</p><small>บริการครบ จบในที่เดียว</small></div><LiveAvailability /></div>
      </section>
      <section className="section-block" id="services">
        <div className="section-heading"><div><span className="section-kicker">บริการของเรา</span><h2>งานช่างที่คุณต้องการ</h2><p>เลือกประเภทงานเพื่อแจ้งรายละเอียดให้ช่าง</p></div></div>
        <div className="service-grid">{services.map(({name,description,Icon,category}) => <Link key={category} href={`/booking?category=${category}`} className="service-card"><span className="service-photo"><img loading="lazy" src={servicePhotos[category].startsWith("http") || servicePhotos[category].startsWith("/") ? servicePhotos[category] : `https://chang.bannbonus.chatgpt.site/images/${servicePhotos[category]}`} alt={`ภาพประกอบงาน${name}`} /></span><span className="service-icon"><Icon size={28} strokeWidth={1.6}/></span><strong>{name}</strong><p>{description}</p><span className="service-more">เลือกบริการ <ArrowUpRight size={16}/></span></Link>)}</div>
      </section>
      <section className="steps-block"><span className="section-kicker">HOW IT WORKS</span><h2>ง่าย ชัดเจน ทุกขั้นตอน</h2><div className="steps-grid"><div><b>01</b><h3>แจ้งงาน</h3><p>เลือกเรียกช่างทันทีหรือนัดหมายล่วงหน้า พร้อมรายละเอียดและรูปอุปกรณ์</p></div><div><b>02</b><h3>เช็กสถานะช่าง</h3><p>ระบบประเมินคิวและความพร้อมจากข้อมูลจริง ทีมงานตรวจสอบคำขอ</p></div><div><b>03</b><h3>ยืนยันวันและเวลา</h3><p>เมื่อเลื่อนนัด ลูกค้าตอบรับในระบบ แล้วทีมงานคอนเฟิร์มและมอบหมายช่าง</p></div></div></section>
      <section className="cta-panel"><div><span className="section-kicker">DAY NERAMIT</span><h2>งานซ่อมที่บ้าน เริ่มได้ที่นี่</h2><p>{dayNeramitBusiness.primaryServiceArea} · เรียกช่างตามสถานะจริง · นัดหมายล่วงหน้าได้ตลอด 24 ชั่วโมง</p><p>สำนักงาน: {dayNeramitBusiness.officeAddress} · <a href={dayNeramitBusiness.officeMapUrl} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>ดูแผนที่สำนักงาน</a></p></div><div className="cta-buttons"><Link className="btn btn-gold" href="/booking?mode=IMMEDIATE">เรียกช่าง <ArrowUpRight size={18}/></Link><a className="btn btn-outline" href="tel:0924367468"><PhoneCall size={17}/> 092-436-7468</a></div></section>
    </>
  );
}
