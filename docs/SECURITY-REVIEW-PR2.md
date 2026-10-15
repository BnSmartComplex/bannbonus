# Security review — Chang24 intake PR #2

- **วันที่ตรวจ:** 2026-10-15
- **สถานะ:** ตรวจ source/diff, dependency audit และ isolated Supabase test project แล้ว; ยังไม่ใช่การรับรอง Production
- **ขอบเขต:** Next.js pages, email OTP, browser Supabase client, upload flow, SQL/RLS/storage migration, dependencies, CI workflow และเอกสาร
- **ขอบเขตที่ไม่ได้ทำ:** ไม่แตะ Supabase Production, ไม่ส่ง OTP email, ไม่ทดสอบ API ด้วยผู้ใช้จริง, ไม่เชื่อม GitHub namespace ใน Vercel, ไม่ merge PR และไม่ deploy

## สรุป

ไม่พบ secret จริงหรือข้อมูลลูกค้าใน PR. `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` เป็นค่าที่เว้นว่างไว้; service-role/LINE values เป็นตัวอย่างที่ปิดและระบุว่า server-only. มีการ apply migration เฉพาะ `chang24-test` ซึ่งตรวจแล้วว่างก่อนเริ่ม; read-only check หลัง hardening ให้ผลจริงครบ 25 invariants. tenant/RPC suite ไปถึง assertion สุดท้ายและ fixture rollback ครบ แต่ connector ไม่เปิดเผย TAP report ทั้งชุด จึงระบุเป็นหลักฐานบางส่วน ไม่ใช่ full pass. `npm audit --omit=dev` สะอาด; high advisory ที่เหลืออยู่ในสาย dependency สำหรับ ESLint ฝั่ง development.

พบข้อบกพร่องก่อน merge ซึ่งแก้ใน Branch แล้ว ได้แก่ Supabase grants ที่ไม่ได้ระบุ, self-signup จาก OTP, การเลือก tenant แบบไม่ deterministic, category ที่ backend ไม่จำกัด, write ที่ไม่มี idempotency และการแก้ bucket เดิมเมื่อชน ID. ตรวจด้วย Supabase docs ว่า Data API grants เป็นคนละชั้นกับ RLS; RLS ที่ถูกต้องไม่ทำให้ role มีสิทธิ์เรียก object ได้เอง.

## ข้อค้นพบและการแก้ไข

| ระดับ | ประเด็น | การแก้/สถานะ |
|---|---|---|
| **High — dependency/toolchain** | `npm audit` พบ 5 affected-package entries ในสาย `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces`; มี GHSA [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) (CVSS 7.5, deeply nested patterns causing stack-exhaustion DoS). เป็น dependency สำหรับ development/lint ไม่ใช่ production dependency; `npm audit --omit=dev` ไม่พบ advisory. | **ยังคงเปิดไว้และบันทึกแล้ว.** รุ่น `braces` ล่าสุดที่ตรวจยังเป็น 3.0.3 และอยู่ใน affected range. npm เสนอ downgrade `eslint-config-next` เป็น 14.2.35 ซึ่งรับ ESLint 7/8 แต่ repo ใช้ ESLint 9; ไม่ downgrade major/สร้าง mismatch โดยไม่มีการทดสอบ. ติดตาม patch upstream และอัปเดตเมื่อมีรุ่นที่เข้ากันได้. |
| **Medium — Data API/RLS** | Migration พึ่ง RLS แต่ไม่ประกาศ table grants; Supabase ระบุว่า grants คุม object access ส่วน RLS คุม rows และ default grants สำหรับ project ใหม่กำลังเปลี่ยนเป็น opt-in. | **แก้แล้ว:** revoke broad/default table access, grant เฉพาะ `SELECT` ให้ `authenticated` บนตารางที่มี read policy และ grant `EXECUTE` เฉพาะ RPC ให้ `authenticated`; `anon` ไม่มี access. ยังต้องทดสอบกับ Supabase project จริงแบบ non-production. |
| **Medium — account provisioning** | Email OTP อนุญาต auto-create user หากไม่กำหนด `shouldCreateUser: false`; starter ไม่มี self-service tenant/membership provisioning ที่เชื่อถือได้. | **แก้แล้ว:** ปิดการสร้างบัญชีอัตโนมัติและตอบข้อความแบบไม่ยืนยันว่ามีบัญชีหรือไม่; การ provision role ยังต้องทำโดย trusted admin. |
| **High — tenant isolation** | RPC เดิมเลือก tenant ด้วย `ORDER BY ... LIMIT 1`; บัญชีที่มี customer membership หลาย tenant อาจถูกผูกกับ tenant ที่ไม่ได้ตั้งใจ. | **แก้แล้ว:** RPC ต้องพบ customer membership เพียงหนึ่งรายการ ไม่เช่นนั้นหยุดด้วย error; เพิ่ม composite foreign keys ระหว่าง booking, tenant, photos, outbox และ audit. ต้องทดสอบ cross-tenant ใน Supabase. |
| **Medium — business validation** | RPC เดิมรับ category string ใดก็ได้ แม้หน้า UI แสดงรายการที่จำกัด. | **แก้แล้ว:** ใช้ allowlist เดียวกันเชิงค่าใน Zod และ SQL constraint/RPC; เพิ่ม regression test ของ category นอก allowlist. |
| **Medium — duplicate requests/audit** | RPC เดิมไม่มี idempotency key; retry หลัง timeout อาจสร้าง booking/outbox/audit ซ้ำ. | **แก้แล้ว:** unique `(customer_id, idempotency_key)`, retry คืน booking เดิม, จับ concurrent unique conflict; browser เก็บ key ใน `sessionStorage` ระหว่าง retry และเปลี่ยนเมื่อฟอร์ม/รูปเปลี่ยน. รูปที่อัปโหลดซ้ำก่อน RPC retry สำเร็จอาจยังเกิด orphan object; ต้องมี cleanup policy ก่อนใช้งานจริง. |
| **Medium — storage change safety** | `ON CONFLICT DO UPDATE` อาจแก้ private/size/MIME config ของ bucket เดิมโดยไม่ตรวจว่า bucket นั้นถูกใช้งานอื่นหรือไม่. | **แก้แล้ว:** ใช้ `DO NOTHING` และ fail closed หาก bucket configuration ไม่ตรง; ไม่ปรับ bucket ที่มีอยู่โดยอัตโนมัติ. ต้องทดสอบบน isolated project. |
| **Medium — consent evidence** | เดิมยอมรับ checkbox แต่ไม่เก็บเวลา/รุ่นข้อความไว้กับคำขอ. | **แก้แล้วบางส่วน:** เพิ่ม `consent_given_at` และ `consent_notice_version`. **ยังไม่ใช่การรับรอง PDPA:** ต้องมี privacy notice ที่ผ่านผู้รับผิดชอบ, purpose/retention, deletion/data-subject process และ policy breach response ก่อนรับข้อมูลจริง. |
| **Low — CI reproducibility** | CI เดิมรัน `npm install --package-lock-only` ก่อน `npm ci` ซึ่งอาจ re-resolve lockfile ใน runner และลดความสามารถในการตรวจ lockfile ที่ commit. | **แก้แล้ว:** ตัดขั้น re-resolve ออก ให้ `npm ci` ใช้ lockfile จาก branch โดยตรง. |

**Maintenance warning (ไม่ใช่ security advisory):** `npm ci` แจ้งว่า ESLint 9.39.5 ไม่ได้รับการ support แล้ว ขณะที่ `eslint-config-next@15.5.28` ประกาศ peer รองรับ ESLint ถึง major 9 เท่านั้น. อัปเกรดให้ตรงกันต้องประเมิน Next.js/config major ร่วมกัน; ไม่เปลี่ยน major แบบคาดเดาใน PR นี้.

## Release gates ที่ยังเปิดอยู่

1. **Integration evidence ยังไม่ครบ:** API/Auth/Storage tests, OTP no-auto-create, concurrency/idempotency race และ backup/restore rehearsal ยังไม่ได้รัน แม้ structural check 25 จุดจะผ่านและ transactional tenant/RPC suite ไปถึง assertion สุดท้าย
2. **ห้ามรับข้อมูลบุคคลจริงจนกว่าจะอนุมัติ privacy notice/retention/deletion** และกำหนดผู้รับผิดชอบข้อมูล; timestamp/version ที่เพิ่มเป็นเพียงหลักฐานเชิงเทคนิค ไม่ใช่คำยินยอมที่ตรวจสอบทางกฎหมายแล้ว
3. **Upload hardening:** allowlist MIME และขนาดถูกเช็กทั้ง UI/bucket แต่ยังไม่มี server-side content sniffing, malware scanning, EXIF stripping, staff image access design หรือ orphan-object retention cleanup
4. **Abuse control:** ยังไม่มี application-level rate limit/CAPTCHA สำหรับ OTP หรือ RPC; ต้องกำหนด quota/abuse response และทดสอบก่อนเปิด public intake
5. **Provisioning/operations:** ไม่มี workflow สร้าง tenant/membership โดยผู้ดูแล, ไม่มี staff approval/scheduling, ไม่มี outbox worker/retry monitor และไม่มี backup/restore test
6. **Hosting/deployment:** บัญชี Vercel ปัจจุบันเชื่อม GitHub namespace `dayneramit` เท่านั้น; ค้น `BnSmartComplex/bannbonus` ได้ 0 repositories. `chang24.vercel.app` ตอบ `404 DEPLOYMENT_NOT_FOUND`. จึงไม่มี project/repository target ที่พร้อม deploy และไม่มี Production Supabase project/credentials ที่ยืนยันได้.
7. **Existing public endpoints (GET only, 2026-10-15):** Vercel URL ตอบ `404 DEPLOYMENT_NOT_FOUND`; Firebase page แสดง claims “Production AI Active”/“ระบบจริง” แต่มีตัวเลข 0. การตรวจหน้าไม่ยืนยันว่า backend/AI เป็นจริงหรือเป็นข้อมูลจำลอง; เจ้าของระบบควรตรวจถ้อยคำและ data source ก่อนนำเสนอหรือเปลี่ยนหน้า.

## Validation

- `npm ci --no-audit --no-fund`: ผ่านจาก lockfile ของ Branch
- `npm run lint`: ผ่าน ไม่มี error/warning
- `npm run typecheck`: ผ่าน
- `npm test -- --passWithNoTests`: ผ่าน **4/4 tests** รวม category allowlist regression
- `npm run build`: ผ่านบน Next.js 15.5.28; หน้า `/`, `/booking`, `/login`, `/my-bookings` และ `/staff` ถูก prerender เป็น static routes
- **Static-export dry-run:** เพิ่ม `output: "export"` ชั่วคราวเฉพาะใน workspace; build ผ่านและสร้าง HTML สำหรับทุก route ข้างต้น จากนั้นลบ output/คืน `next.config.ts` เดิมแล้ว ไม่มี Firebase config หรือ deployment ถูกเพิ่ม
- **SQL syntax:** parser ตรวจ migration เดิมและ migration 0002 (24 statements) ผ่าน; migration 0001/0002 ถูก apply เฉพาะ `chang24-test` แล้ว
- `git diff --check`: ผ่าน
- `npm audit`: 5 high package entries ใน dev lint chain; `npm audit --omit=dev`: 0 advisories (Critical/High/Moderate/Low = 0)

**Supabase test evidence:** หลัง migration `0002`, read-only aggregate ตรวจ 25 schema/grant/RLS/index/bucket invariants แล้วได้ `true` ทุกข้อ. Tenant/RPC pgTAP SQL ไปถึง `ok 19 - RPC never confirms the booking automatically`; หลัง `ROLLBACK` ยืนยัน synthetic user/tenant/booking/membership/outbox/audit/storage counts เป็น 0. SQL connector แสดงเฉพาะ result row สุดท้าย จึงยังไม่มี TAP report ครบทุก assertion. Supabase advisor เหลือ warning เดียวสำหรับ `SECURITY DEFINER` RPC ซึ่งตั้งใจให้ authenticated เรียกเพื่อส่งคำขอ; grants จำกัดเฉพาะ authenticated และ function ใช้ empty `search_path`. Performance advisor ไม่พบ unindexed FK/auth-initplan warnings; รายงาน indexes ว่า unused เพราะ test tables ว่าง.

## Phase 2 — integration test preparation

Added pgTAP schema/RLS/RPC suites, a read-only security snapshot, an isolated-project API harness, environment template, integration test plan, rollback plan, and production-readiness checklist. The schema was applied only to the empty `chang24-test` project; no Production resource was changed. Structural SQL checks passed and the tenant/RPC test transaction rolled back all fixtures. **API/Auth/Storage tests and complete TAP output remain unverified; no Production pass is claimed.** The API harness requires an explicit non-production acknowledgement and uses only anon-key client sessions; it has no service-role key and does not create or delete booking/object fixtures.

## แหล่งอ้างอิง

- [Supabase — Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase — Passwordless email sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [GitHub Advisory — braces stack-exhaustion DoS](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Firebase App Hosting overview](https://firebase.google.com/docs/app-hosting)
- [Vercel — Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs)
