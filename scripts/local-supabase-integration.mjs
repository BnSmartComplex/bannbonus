import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createClient } from "@supabase/supabase-js";

// Only the disposable local stack is accepted, even if remote credentials exist.
assert.equal(process.env.SUPABASE_LOCAL_TEST_CONFIRM, "DISPOSABLE_LOCAL_STACK");
const status = JSON.parse(await readFile(process.env.SUPABASE_LOCAL_STATUS_FILE, "utf8"));
const api = new URL(status.API_URL);
const db = new URL(status.DB_URL);
assert.ok(["127.0.0.1", "localhost"].includes(api.hostname));
assert.ok(["127.0.0.1", "localhost"].includes(db.hostname));
assert.equal(api.protocol, "http:");
assert.equal(api.port, "54321");
assert.equal(db.port, "54322");
assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY);

const options = { auth: { persistSession: false, autoRefreshToken: false } };
const client = () => createClient(api.origin, status.ANON_KEY, options);
const admin = createClient(api.origin, status.SERVICE_ROLE_KEY, options);
const ids = { tenant: randomUUID(), otherTenant: randomUUID() };
const accounts = {};
let scenarios = 0;
function passed(name) { scenarios += 1; console.log("PASS: " + name); }
function ok(result, context) {
  assert.equal(result.error, null, context + ": " + result.error?.message);
  return result.data;
}
function sql(query) {
  const result = spawnSync("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-At"], {
    input: query, encoding: "utf8", env: {
      ...process.env, PGHOST: db.hostname, PGPORT: db.port,
      PGUSER: decodeURIComponent(db.username),
      PGPASSWORD: decodeURIComponent(db.password), PGDATABASE: db.pathname.slice(1),
    },
  });
  assert.equal(result.status, 0, "local fixture/query SQL failed: " + result.stderr);
  return result.stdout.trim();
}

for (const role of ["operatorA", "operatorB", "technician", "customer", "outsider"]) {
  const email = "integration-" + randomUUID() + "@example.test";
  const password = randomBytes(24).toString("base64url");
  const { user } = ok(await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  }), "create isolated account");
  const sessionClient = client();
  ok(await sessionClient.auth.signInWithPassword({ email, password }), "real password sign-in");
  accounts[role] = { id: user.id, email, password, client: sessionClient };
}
passed("five real Auth users sign in through HTTP");
assert.ok((await client().auth.signInWithPassword({
  email: accounts.customer.email, password: "incorrect-password",
})).error);
passed("invalid password denied");

sql(`insert into public.tenants(id,name) values
  ('${ids.tenant}','local-integration'),('${ids.otherTenant}','local-isolation');
insert into public.tenant_memberships(tenant_id,user_id,role) values
  ('${ids.tenant}','${accounts.operatorA.id}','operator'),
  ('${ids.tenant}','${accounts.operatorB.id}','operator'),
  ('${ids.tenant}','${accounts.technician.id}','technician'),
  ('${ids.tenant}','${accounts.customer.id}','customer'),
  ('${ids.otherTenant}','${accounts.outsider.id}','customer');`);

const owner = accounts.customer.client;
const outsider = accounts.outsider.client;
const bucket = "equipment-photos";
const photoPath = accounts.customer.id + "/" + randomUUID() + ".png";
// Synthetic 1px PNG used only as an HTTP upload fixture.
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1sAAAAASUVORK5CYII=", "base64");
ok(await owner.storage.from(bucket).upload(photoPath, png, { contentType: "image/png" }), "owner upload");
const downloaded = ok(await owner.storage.from(bucket).download(photoPath), "owner download");
assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
passed("Storage HTTP upload and byte-exact owner download");
assert.ok((await outsider.storage.from(bucket).download(photoPath)).error);
assert.ok((await client().storage.from(bucket).download(photoPath)).error);
passed("cross-user and anonymous Storage reads denied");
assert.ok((await outsider.storage.from(bucket).upload(photoPath, png, {
  contentType: "image/png", upsert: true,
})).error);
assert.ok((await outsider.storage.from(bucket).upload(
  accounts.customer.id + "/" + randomUUID() + ".png", png, { contentType: "image/png" },
)).error);
passed("cross-user overwrite and path spoofing denied");

async function booking() {
  return ok(await owner.rpc("create_booking_request", {
    p_category: "OTHER", p_fault_description: "Synthetic HTTP integration fault description.",
    p_brand: "Test fixture", p_model_number: "TEST-ONLY", p_area: "BANGKOK",
    p_contact_name: "Integration fixture", p_contact_phone: "0800000000",
    p_photo_paths: [], p_consent: true, p_idempotency_key: randomUUID(),
  }), "customer booking intake");
}
const tomorrow = new Date(Date.now() + 86400000);
tomorrow.setUTCHours(3, 0, 0, 0); // 10:00 Asia/Bangkok.
function payload(id, day) {
  const start = new Date(tomorrow.getTime() + day * 86400000);
  return { p_booking_id: id, p_technician_id: accounts.technician.id,
    p_scheduled_start: start.toISOString(),
    p_scheduled_end: new Date(start.getTime() + 3600000).toISOString() };
}
const operators = [accounts.operatorA.client, accounts.operatorB.client];
for (let attempt = 0; attempt < 5; attempt += 1) {
  const id = await booking();
  const request = payload(id, attempt);
  const before = ok(await operators[0].from("booking_appointments").select("id").eq("booking_id", id), "fresh race precondition");
  assert.equal(before.length, 0, "race must begin with an unapproved booking");
  const results = await Promise.all(operators.map((operator) => operator.rpc("approve_booking_and_assign_technician", request)));
  const returned = results.map((result) => ok(result, "concurrent exact approval"));
  assert.equal(returned[0], returned[1]);
  const rows = ok(await operators[0].from("booking_appointments").select("id,payment_status,actual_dispatch_fee_baht").eq("booking_id", id), "race result");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payment_status, "NOT_CHARGED");
  assert.equal(rows[0].actual_dispatch_fee_baht, null);
  assert.equal(sql(`select count(*) from public.audit_logs where entity_id='${id}' and action='BOOKING_APPROVED_AND_ASSIGNED';`), "1");
}
passed("five fresh two-session exact approval races: one appointment and one audit each");

for (let attempt = 0; attempt < 3; attempt += 1) {
  const bookings = await Promise.all([booking(), booking()]);
  const results = await Promise.all(operators.map((operator, index) => operator.rpc(
    "approve_booking_and_assign_technician", payload(bookings[index], attempt + 5),
  )));
  assert.equal(results.filter((result) => !result.error).length, 1);
  assert.equal(results.filter((result) => result.error?.message.includes("TECHNICIAN_TIME_CONFLICT")).length, 1);
  assert.equal(sql(`select count(*) from public.booking_appointments where booking_id in ('${bookings[0]}','${bookings[1]}');`), "1");
  assert.equal(sql(`select count(*) from public.booking_requests where id in ('${bookings[0]}','${bookings[1]}') and status='PENDING_TEAM_REVIEW';`), "1");
}
passed("three competing-booking races: one winner, one pending loser, no double assignment");

const id = await booking();
const appointment = ok(await operators[0].rpc("approve_booking_and_assign_technician", payload(id, 9)), "approval for technician flow");
assert.deepEqual(ok(await outsider.from("booking_appointments").select("id").eq("id", appointment), "outsider RLS read"), []);
assert.ok((await owner.rpc("list_tenant_technicians", { p_tenant_id: ids.tenant })).error);
assert.equal(ok(await operators[0].rpc("list_tenant_technicians", { p_tenant_id: ids.tenant }), "operator directory").length, 1);
passed("HTTP tenant isolation and authorized technician directory");
const tech = accounts.technician.client;
assert.ok((await tech.rpc("technician_update_appointment_status", { p_appointment_id: appointment, p_status: "COMPLETED" })).error);
for (const next of ["ACCEPTED", "IN_PROGRESS", "CANCELLED", "CANCELLED"]) {
  ok(await tech.rpc("technician_update_appointment_status", { p_appointment_id: appointment, p_status: next }), "technician transition " + next);
}
const cancelled = ok(await operators[0].from("booking_requests").select("status").eq("id", id).single(), "operator cancellation read");
assert.equal(cancelled.status, "CANCELLED");
passed("technician transition rejection, valid transitions and idempotent cancellation through HTTP");

// Exercise a genuinely issued short-lived token rather than forging expiry claims.
const expiryClient = client();
const { session } = ok(await expiryClient.auth.signInWithPassword({
  email: accounts.customer.email, password: accounts.customer.password,
}), "expiry session sign-in");
const waitMs = session.expires_at * 1000 - Date.now() + 2000;
assert.ok(waitMs > 0 && waitMs < 90000, "local Auth JWT expiry must be configured to 60 seconds");
await delay(waitMs);
const expired = await fetch(api.origin + "/auth/v1/user", {
  headers: { apikey: status.ANON_KEY, Authorization: "Bearer " + session.access_token },
});
assert.ok([401, 403].includes(expired.status), "expired Auth token must be denied");
// PostgREST documents 30 seconds of JWT clock skew. Verify rejection after
// that window rather than treating its documented grace period as a bypass.
// https://docs.postgrest.org/en/v12/references/auth.html#jwt-claims-validation
await delay(Math.max(0, session.expires_at * 1000 + 32000 - Date.now()));
const expiredRest = await fetch(api.origin + "/rest/v1/booking_requests?select=id", {
  headers: { apikey: status.ANON_KEY, Authorization: "Bearer " + session.access_token },
});
assert.equal(expiredRest.status, 401, "expired REST token must be denied");
ok(await expiryClient.auth.refreshSession(), "refresh after access-token expiry");
const { session: refreshed } = ok(await expiryClient.auth.getSession(), "refreshed session");
ok(await expiryClient.auth.signOut(), "sign out refreshed session");
assert.ok((await client().auth.refreshSession({ refresh_token: refreshed.refresh_token })).error);
passed("real token expiry rejected by Auth/REST; refresh succeeds; signed-out refresh token denied");
console.log("Local Supabase HTTP integration passed: " + scenarios + " scenario groups.");
