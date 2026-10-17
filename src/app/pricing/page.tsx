import Link from "next/link";
import { ServiceTerms } from "@/components/service-terms";

export const metadata = { title: "ค่าบริการเรียกช่าง | ช่างเดย์เนรมิตร" };

export default function PricingPage() {
  return (
    <main>
      <h1>ค่าบริการเรียกช่างและนัดหมาย</h1>
      <ServiceTerms />
      <p>เจ้าหน้าที่ต้องตรวจสอบพื้นที่ ทักษะช่าง และเวลาว่างก่อนยืนยันนัดทุกครั้ง</p>
      <Link className="btn" href="/booking">นัดหมายช่างล่วงหน้า</Link>
    </main>
  );
}
