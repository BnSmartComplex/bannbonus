import Link from "next/link";
import { ServiceTerms } from "@/components/service-terms";

export const metadata = { title: "เวลารับงานและค่าบริการ | BannBonus" };

export default function PricingPage() {
  return (
    <main>
      <h1>Booking และค่าบริการ</h1>
      <ServiceTerms />
      <p>เจ้าหน้าที่ต้องตรวจสอบพื้นที่ ทักษะช่าง และเวลาว่างก่อนยืนยันนัดทุกครั้ง</p>
      <Link className="btn" href="/booking">ส่งคำขอ Booking ล่วงหน้า</Link>
    </main>
  );
}
