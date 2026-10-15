import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_TEST_ENVIRONMENT",
  "SUPABASE_TEST_CONFIRM",
  "SUPABASE_TEST_PROJECT_REF",
  "SUPABASE_TEST_URL",
  "SUPABASE_TEST_ANON_KEY",
  "SUPABASE_TEST_CUSTOMER_A_EMAIL",
  "SUPABASE_TEST_CUSTOMER_A_PASSWORD",
  "SUPABASE_TEST_CUSTOMER_B_EMAIL",
  "SUPABASE_TEST_CUSTOMER_B_PASSWORD",
  "SUPABASE_TEST_OPERATOR_A_EMAIL",
  "SUPABASE_TEST_OPERATOR_A_PASSWORD",
  "SUPABASE_TEST_OPERATOR_B_EMAIL",
  "SUPABASE_TEST_OPERATOR_B_PASSWORD",
  "SUPABASE_TEST_TENANT_ADMIN_A_EMAIL",
  "SUPABASE_TEST_TENANT_ADMIN_A_PASSWORD",
  "SUPABASE_TEST_TECHNICIAN_A_EMAIL",
  "SUPABASE_TEST_TECHNICIAN_A_PASSWORD",
  "SUPABASE_TEST_BOOKING_A_ID",
  "SUPABASE_TEST_BOOKING_B_ID",
  "SUPABASE_TEST_STORAGE_PATH_A",
];

function fail(message) {
  console.error(`Supabase API checks refused: ${message}`);
  process.exit(2);
}

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) fail(`missing required variables: ${missing.join(", ")}`);
if (process.env.SUPABASE_TEST_ENVIRONMENT !== "isolated") {
  fail("SUPABASE_TEST_ENVIRONMENT must be exactly 'isolated'");
}
if (process.env.SUPABASE_TEST_CONFIRM !== "I_HAVE_VERIFIED_NON_PRODUCTION") {
  fail("explicit non-production acknowledgement is required");
}
if (process.env.SUPABASE_TEST_SERVICE_ROLE_KEY) {
  fail("service-role keys are forbidden in this API harness");
}

let projectUrl;
try {
  projectUrl = new URL(process.env.SUPABASE_TEST_URL);
} catch {
  fail("SUPABASE_TEST_URL is not a valid URL");
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const isLocal = localHosts.has(projectUrl.hostname);
if (!isLocal && projectUrl.protocol !== "https:") {
  fail("remote test projects must use HTTPS");
}
if (!isLocal && !projectUrl.hostname.endsWith(".supabase.co")) {
  fail("remote host must be a Supabase project URL; custom hosts require a reviewed harness change");
}
if (!isLocal && projectUrl.hostname.split(".")[0] !== process.env.SUPABASE_TEST_PROJECT_REF) {
  fail("project ref does not match the host in SUPABASE_TEST_URL");
}
if (!/^[0-9a-f-]{36}$/i.test(process.env.SUPABASE_TEST_BOOKING_A_ID)
    || !/^[0-9a-f-]{36}$/i.test(process.env.SUPABASE_TEST_BOOKING_B_ID)) {
  fail("booking fixture IDs must be UUIDs");
}

const supabaseUrl = projectUrl.toString().replace(/\/$/, "");
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
const bucket = "equipment-photos";
const bookingA = process.env.SUPABASE_TEST_BOOKING_A_ID;
const bookingB = process.env.SUPABASE_TEST_BOOKING_B_ID;
const storagePathA = process.env.SUPABASE_TEST_STORAGE_PATH_A;

function client() {
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(label) {
  const supabase = client();
  const email = process.env[`SUPABASE_TEST_${label}_EMAIL`];
  const password = process.env[`SUPABASE_TEST_${label}_PASSWORD`];
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) {
    throw new Error(`${label} test account sign-in failed${error?.code ? ` (${error.code})` : ""}`);
  }
  return { supabase, userId: data.user.id };
}

async function assertBookingVisibility(identity, bookingId, expected, description) {
  const { data, error } = await identity.supabase
    .from("booking_requests")
    .select("id")
    .eq("id", bookingId);
  if (error) throw new Error(`${description}: query failed (${error.code ?? "unknown"})`);
  const count = data?.length ?? 0;
  if (count !== (expected ? 1 : 0)) {
    throw new Error(`${description}: expected ${expected ? "one visible row" : "no visible rows"}, got ${count}`);
  }
}

async function assertStorageDenied(operation, description) {
  const { data, error } = await operation;
  if (!error && data) throw new Error(`${description}: unauthorized object data was returned`);
  if (error && !["42501", "PGRST301", "PGRST302"].includes(error.code ?? "")) {
    throw new Error(`${description}: unexpected error (${error.code ?? "unknown"})`);
  }
}

const identities = {};
const checks = [];
function add(name, run) {
  checks.push({ name, run });
}

try {
  for (const label of [
    "CUSTOMER_A",
    "CUSTOMER_B",
    "OPERATOR_A",
    "OPERATOR_B",
    "TENANT_ADMIN_A",
    "TECHNICIAN_A",
  ]) {
    identities[label] = await signIn(label);
  }

  if (!storagePathA.startsWith(`${identities.CUSTOMER_A.userId}/`)) {
    fail("storage fixture path must be inside customer A's user-ID folder");
  }

  add("customer A reads own booking", () => assertBookingVisibility(identities.CUSTOMER_A, bookingA, true, "customer A / booking A"));
  add("customer A cannot read tenant B booking", () => assertBookingVisibility(identities.CUSTOMER_A, bookingB, false, "customer A / booking B"));
  add("customer B reads own booking", () => assertBookingVisibility(identities.CUSTOMER_B, bookingB, true, "customer B / booking B"));
  add("customer B cannot read tenant A booking", () => assertBookingVisibility(identities.CUSTOMER_B, bookingA, false, "customer B / booking A"));
  add("operator A reads tenant A booking", () => assertBookingVisibility(identities.OPERATOR_A, bookingA, true, "operator A / booking A"));
  add("operator A cannot read tenant B booking", () => assertBookingVisibility(identities.OPERATOR_A, bookingB, false, "operator A / booking B"));
  add("operator B reads tenant B booking", () => assertBookingVisibility(identities.OPERATOR_B, bookingB, true, "operator B / booking B"));
  add("operator B cannot read tenant A booking", () => assertBookingVisibility(identities.OPERATOR_B, bookingA, false, "operator B / booking A"));
  add("tenant admin A reads tenant A booking", () => assertBookingVisibility(identities.TENANT_ADMIN_A, bookingA, true, "tenant admin A / booking A"));
  add("technician cannot read the general booking queue", () => assertBookingVisibility(identities.TECHNICIAN_A, bookingA, false, "technician / booking A"));

  const anonymous = client();
  add("anonymous cannot read booking fixtures", async () => {
    const { data, error } = await anonymous.from("booking_requests").select("id").eq("id", bookingA);
    if (data?.length) throw new Error("anonymous client received a booking row");
    if (error && !["42501", "PGRST301", "PGRST302"].includes(error.code ?? "")) {
      throw new Error(`unexpected anonymous query error (${error.code ?? "unknown"})`);
    }
  });

  add("customer A downloads own private object", async () => {
    const { data, error } = await identities.CUSTOMER_A.supabase.storage.from(bucket).download(storagePathA);
    if (error || !data || data.size === 0) throw new Error(`owner download failed${error?.code ? ` (${error.code})` : ""}`);
  });
  add("customer B cannot download customer A object", () => assertStorageDenied(
    identities.CUSTOMER_B.supabase.storage.from(bucket).download(storagePathA),
    "cross-user Storage download",
  ));
  add("anonymous client cannot download private object", () => assertStorageDenied(
    anonymous.storage.from(bucket).download(storagePathA),
    "anonymous Storage download",
  ));
  add("customer A can create a short-lived signed URL", async () => {
    const { data, error } = await identities.CUSTOMER_A.supabase.storage.from(bucket).createSignedUrl(storagePathA, 60);
    if (error || !data?.signedUrl) throw new Error(`owner signed URL failed${error?.code ? ` (${error.code})` : ""}`);
  });
  add("customer B cannot sign customer A object", () => assertStorageDenied(
    identities.CUSTOMER_B.supabase.storage.from(bucket).createSignedUrl(storagePathA, 60),
    "cross-user signed URL creation",
  ));
  add("private object is not served through public URL", async () => {
    const publicUrl = identities.CUSTOMER_A.supabase.storage.from(bucket).getPublicUrl(storagePathA).data.publicUrl;
    const response = await fetch(publicUrl, { redirect: "manual" });
    if (response.ok) throw new Error("public-object endpoint returned the private object");
  });

  let failures = 0;
  for (const check of checks) {
    try {
      await check.run();
      console.log(`PASS ${check.name}`);
    } catch (error) {
      failures += 1;
      console.error(`FAIL ${check.name}: ${error instanceof Error ? error.message : "unexpected error"}`);
    }
  }

  console.log(`Supabase API checks: ${checks.length - failures}/${checks.length} passed`);
  if (failures) process.exitCode = 1;
} catch (error) {
  console.error(`Supabase API checks aborted: ${error instanceof Error ? error.message : "unexpected error"}`);
  process.exitCode = 1;
}
