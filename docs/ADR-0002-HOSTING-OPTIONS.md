# ADR-0002: แนวทางโฮสต์เว็บเดียวกันบน Vercel และ Firebase Hosting

- **สถานะ:** Proposed — ยังไม่อนุมัติและยังไม่เปลี่ยนระบบจริง
- **วันที่:** 2026-10-15
- **ขอบเขต:** เปรียบเทียบการให้ `chang24.vercel.app` และ `bannbonus.web.app` ใช้ codebase เดียวกันและ Supabase project เดียวกัน
- **ข้อห้ามในรอบนี้:** ห้ามสร้าง Firebase App Hosting backend, แก้ DNS/hosting config, เพิ่ม production secrets, รัน migration หรือ deploy

## บริบทและสิ่งที่ตรวจพบ

PR นี้เพิ่ม Next.js App Router starter ซึ่งเรียก Supabase จาก browser ด้วย public URL/anon key; ยังไม่มี Next.js API route/Route Handler, server-side service-role key, Firebase config หรือ Supabase production project. การมี Supabase project เดียวไม่ได้ทำให้ session ของผู้ใช้แชร์ข้าม origin โดยอัตโนมัติ ผู้ใช้ต้องเข้าสู่ระบบแยกแต่ละโดเมน และต้อง allowlist redirect URL ของทุกโดเมนใน Supabase Auth.

ตรวจ URL แบบอ่านอย่างเดียวเมื่อ 2026-10-15:

- `https://chang24.vercel.app` ตอบ HTTP 404 พร้อมข้อความ Vercel `DEPLOYMENT_NOT_FOUND` ณ เวลาตรวจ จึงยังยืนยันไม่ได้ว่า URL นี้ผูกกับ deployment ปัจจุบัน
- `https://bannbonus.web.app` แสดงหน้า “Production AI Active”, “ระบบจริง” และตัวเลข CRM/Audit Logs เป็น 0; การตรวจหน้าเว็บอย่างเดียว **ไม่ยืนยัน** ว่าระบบ AI, ฐานข้อมูล หรือข้อมูลบนหน้านั้นเป็นของจริงหรือเป็นข้อมูลจำลอง และยังไม่ได้ทดสอบระบบหลังบ้าน

ข้อสังเกตนี้มีไว้ช่วยแยกสถานะสาธารณะออกจากสิ่งที่โค้ดใน PR ทำได้ ไม่ได้เปลี่ยนหรือเผยแพร่หน้าเว็บใด

ทดสอบเพิ่มโดยใส่ `output: "export"` ชั่วคราวใน workspace แล้ว build สำเร็จและสร้าง static HTML สำหรับ 5 routes ปัจจุบัน; จากนั้นคืน `next.config.ts` เดิมและลบ output ทดสอบแล้ว. Next.js สร้าง `booking.html`, `login.html` ฯลฯ เมื่อ `trailingSlash` เป็นค่าเริ่มต้น; Firebase Hosting รองรับ `cleanUrls: true` เพื่อให้ URL ไม่มี `.html` หรือเลือก `trailingSlash: true` ให้เกิด `route/index.html`. หากอนุมัติทางเลือก B ต้องกำหนดอย่างใดอย่างหนึ่งใน `firebase.json` และทดสอบ deep-link/refresh; ยังไม่มี config ถูกเพิ่มหรือ deploy.

Static export ใช้ได้กับหน้า browser-only ปัจจุบัน แต่ไม่รองรับความสามารถที่ต้องใช้ Node.js runtime เช่น dynamic SSR, Server Actions, Route Handlers ที่อ่าน request/cookies, proxy/rewrites หรือ default image optimization. หากมีความต้องการเหล่านี้ ต้องกลับมาพิจารณา App Hosting หรือ Cloud Run ไม่ใช่เพิ่มฟีเจอร์ server โดยคาดหวังว่า static Hosting จะทำงานต่อได้.

## ทางเลือก

| ทางเลือก | Runtime ที่แต่ละโดเมนได้รับ | จุดเด่น | ข้อจำกัด/ความเสี่ยง | ความเหมาะสม |
|---|---|---|---|---|
| **A. Vercel + Firebase App Hosting** | deploy Next.js แบบเต็มสองชุด โดยแต่ละผู้ให้บริการสร้าง runtime ของตน | รองรับ Next.js SSR/Route Handlers ได้ทั้งสองฝั่ง; App Hosting ใช้ Cloud Build, Cloud Run และ Cloud CDN; GitHub integration ทำ rollout จาก branch ได้ | เป็นสอง deployment และต้องตั้งค่า/หมุน secret, Auth redirect, log, alert และ rollback แยกกัน; ต้องยืนยันว่าโดเมน `bannbonus.web.app` ที่มีอยู่ผูกกับ App Hosting ได้อย่างไร; Firebase App Hosting ต้องใช้ Firebase project ที่เปิด Blaze และการ push เข้า live branch อาจเริ่ม rollout อัตโนมัติ | เหมาะเมื่อ Firebase domain ต้องรองรับ server-side Next.js จริง และเจ้าของอนุมัติค่าใช้จ่าย/การย้ายโดเมนแล้ว |
| **B. Vercel + Firebase Hosting แบบ static export** | Vercel เป็น Next.js runtime; Firebase เสิร์ฟไฟล์ HTML/CSS/JS ที่ build จาก commit เดียวกัน | ใช้ Firebase Hosting เดิมและคง `bannbonus.web.app`; เหมาะกับโค้ดปัจจุบันซึ่งเรียก Supabase จาก browser และยังไม่มี server route; พื้นผิวปฏิบัติการน้อยกว่า App Hosting | ต้องพิสูจน์ `output: 'export'` ผ่าน build และทดสอบ routes/assets; ไม่มี SSR, Route Handlers หรือ secrets ฝั่ง server บน Firebase Hosting; env สาธารณะยังเปิดเผยต่อ browser; code/asset อาจมี build config ต่างกันระหว่าง provider | **ตัวเลือกที่ควรทดลองก่อน** หากฟังก์ชันในสองโดเมนยังเป็น browser-only และยืนยัน static export ได้ |
| **C. Vercel + Firebase Hosting rewrite ไป Cloud Run/Functions** | Vercel รัน Next.js; Firebase Hosting ส่งบาง routes ไปบริการบน Google Cloud | รักษา origin `bannbonus.web.app` และให้ request ฝั่ง Firebase มี backend/runtime บน GCP; ทำ routing แยก frontend/API ได้ | ต้องพัฒนาและดูแล Cloud Run/Function หรือ proxy อีกชั้น, ตั้ง rewrite/method/header/timeout, logging, scaling, billing และ security เพิ่ม; Firebase Hosting rewrite ไม่ใช่ reverse proxy ไป arbitrary external origin อย่าง `chang24.vercel.app`; การ redirect ไป Vercel จะเปลี่ยน URL ของผู้ใช้ | ใช้เมื่อมีเหตุผลเฉพาะให้ Firebase domain คงอยู่และมี API/backend บน GCP; ไม่แนะนำให้เพิ่ม proxy เพียงเพื่อคัดลอก Vercel |
| **D. ย้าย runtime หลักออกจาก Vercel แล้วให้ทั้งสองโดเมนชี้ backend เดียว** | backend/hosting runtime เดียว; แต่ Vercel-managed `*.vercel.app` และ Firebase-managed `*.web.app` ไม่ใช่โดเมน DNS ที่ผู้ใช้ย้ายไปชี้ provider อื่นได้ตามปกติ | ลดการดูแล Next runtime ซ้ำ หากเปลี่ยนโดเมนที่ผู้ใช้ควบคุมได้ | ขัดกับ URL provider-managed ที่ระบุไว้และอาจต้องเปลี่ยนโดเมน/เส้นทางอย่างมีผลต่อผู้ใช้; ต้องออกแบบ edge routing ใหม่ | ไม่เลือกสำหรับข้อกำหนด URL ปัจจุบัน |

## ข้อเสนอเพื่อขออนุมัติภายหลัง

**ยังไม่มีการตัดสินใจเชิงสถาปัตยกรรมที่มีผลจริงใน PR นี้.** ข้อเสนอให้ทดลองในขั้นต่อไปคือ:

1. คง Vercel เป็น runtime หลักของ Next.js สำหรับ `chang24.vercel.app` จนกว่าจะยืนยันการผูก deployment กับ URL นี้ได้
2. สำหรับ `bannbonus.web.app` ให้ทดลองทางเลือก B ใน branch/preview แยก โดยใช้ Supabase project เดียวกัน **เฉพาะเมื่อ** static export ผ่านและไม่มี SSR/API route ที่ต้องใช้บน Firebase
3. หากมีข้อกำหนดให้ Firebase domain ต้องใช้ SSR หรือ API ให้เปรียบเทียบทางเลือก A กับ C อีกครั้ง โดยเอนเอียงไป App Hosting สำหรับ Next.js เต็มรูปแบบ; ก่อนสร้าง backend ต้องตรวจ domain eligibility, Blaze/billing, branch rollout policy และการคืนกลับ
4. ไม่ตั้ง Firebase Hosting rewrite ให้ยิงตรงไป `chang24.vercel.app`; ถ้าต้องใช้ rewrite ต้องมี Cloud Run/Functions target ที่ได้รับอนุมัติและทดสอบ security/traffic อย่างชัดเจน

## ข้อกำหนดร่วม ไม่ว่าจะเลือกทางใด

- ใช้ Supabase project เดียวได้ โดยให้แต่ละ deployment มี `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ที่ตรงกับ environment เดียวกัน ห้ามนำ `service_role` key ไปไว้ใน browser, `NEXT_PUBLIC_*`, Git หรือไฟล์ตัวอย่างที่ใช้งานจริง
- เพิ่ม redirect URLs ของทุก origin ใน Supabase Auth allowlist; cookie/local storage ของสอง origin แยกจากกัน จึงต้องทดสอบ login, OTP callback, logout และ session expiry บนแต่ละโดเมน
- ทดสอบ RLS แบบข้าม tenant, บทบาทลูกค้า/เจ้าหน้าที่, การอ่านรูป private, การส่ง RPC ซ้ำ และการปิดบัญชี/retention ก่อนใส่ข้อมูลบุคคลจริง
- แยก Preview/Staging credentials ออกจาก Production; อย่าให้ preview branch ใช้ Supabase production โดยปริยาย
- ตั้ง rollback ให้ deploy จาก commit ที่ผ่าน CI และเก็บหลักฐาน migration/secret changes; ห้ามเปิด automatic rollout ไป `main` จนกว่าจะอนุมัติ
- หน้า public ปัจจุบันบน Firebase มีข้อความอ้างสถานะ Production/AI; ตรวจความหมายและแหล่งข้อมูลก่อนแทนที่หรือกล่าวอ้างซ้ำ

## เกณฑ์ก่อนเปลี่ยนสถานะ ADR เป็น Accepted

- เจ้าของยืนยันว่า URL ทั้งสองต้องคงอยู่และระบุ canonical site / domain ที่ลูกค้าควรใช้
- ยืนยัน Vercel project/deployment ปัจจุบัน เพราะ URL ที่ตรวจคืน 404
- ระบุ Firebase project/site ที่ถือ `bannbonus.web.app` และยืนยัน route/domain migration ที่รองรับจริง
- มีการอนุมัติค่าใช้จ่าย/แผน Firebase และเลือก deployment branch ที่ไม่ทำให้เกิด rollout โดยไม่ตั้งใจ
- ผ่าน build และ integration test บน preview แยกสำหรับตัวเลือกที่เลือก
- อนุมัติแผน PDPA/privacy notice, retention, deletion และ owner/admin provisioning ก่อนรับข้อมูลบุคคลจริง

## แหล่งข้อมูลทางการ (ตรวจเมื่อ 2026-10-15)

- [Firebase App Hosting overview](https://firebase.google.com/docs/app-hosting) — Next.js support, GitHub integration และ Cloud Build/Cloud Run/Cloud CDN; ระบุการตั้ง Firebase project บน Blaze และ rollout จาก live branch
- [Firebase App Hosting build process](https://firebase.google.com/docs/app-hosting/build) — buildpacks สร้าง container แล้ว publish เป็น Cloud Run revision
- [Firebase App Hosting configuration and secrets](https://firebase.google.com/docs/app-hosting/configure) — env variables, BUILD/RUNTIME availability, Secret Manager และ Cloud Run settings
- [Firebase App Hosting custom domains](https://firebase.google.com/docs/app-hosting/custom-domain) — การเพิ่ม custom domain และ DNS verification; ต้องยืนยันการใช้ Firebase-managed `web.app` domain แยกต่างหาก
- [Firebase Hosting full config](https://firebase.google.com/docs/hosting/full-config) — `cleanUrls` ตัด `.html` และ Hosting rewrites ทำงานตามลำดับ priority ที่กำหนด
- [Firebase Hosting rewrites](https://firebase.google.com/docs/hosting/full-config#rewrites) — target ของ rewrite เช่น Cloud Functions/Cloud Run; ไม่ใช่การกำหนด arbitrary external origin proxy
- [Firebase Hosting framework integration for Next.js](https://firebase.google.com/docs/hosting/frameworks/nextjs) — เอกสารอัปเดต 2026-10-13 ระบุว่า framework-aware Hosting ยังเป็น early public preview และ **ปิดรับผู้เข้าร่วมใหม่ถาวร**; ผู้ที่ใช้อยู่แล้วได้รับคำแนะนำให้ย้ายไป App Hosting. ดังนั้นไม่ควรวางแผนเริ่มใช้งาน integration นี้กับ Firebase project ใหม่
- [Next.js static exports](https://nextjs.org/docs/app/guides/static-exports) — output route files, `trailingSlash` และ unsupported server-side features
- [Vercel: Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs) — SSR ผ่าน Vercel Functions และ support App Router/streaming
- [Vercel: deployment environments](https://vercel.com/docs/deployments/environments) และ [environment variables](https://vercel.com/docs/environment-variables) — Preview/Production และการกำหนดค่าตัวแปรแยก environment
- [Supabase: Securing your API](https://supabase.com/docs/guides/api/securing-your-api) — Postgres grants คุม object access แยกจาก RLS ที่คุมแถว และแนวทาง grant เท่าที่จำเป็น
- [Supabase: Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless) — `shouldCreateUser: false` และการกำหนด redirect URL
