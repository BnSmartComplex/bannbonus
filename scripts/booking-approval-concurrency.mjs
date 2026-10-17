import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const required = [
  "SUPABASE_URL", "SUPABASE_ANON_KEY", "BOOKING_ID", "TECHNICIAN_ID",
  "SCHEDULED_START", "SCHEDULED_END", "OPERATOR_A_EMAIL", "OPERATOR_A_PASSWORD",
  "OPERATOR_B_EMAIL", "OPERATOR_B_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error("Missing isolated-test variables: " + missing.join(", "));
}

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const base = {
  p_booking_id: process.env.BOOKING_ID,
  p_technician_id: process.env.TECHNICIAN_ID,
  p_scheduled_start: process.env.SCHEDULED_START,
  p_scheduled_end: process.env.SCHEDULED_END,
};

async function authenticatedClient(email, password) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Auth setup failed for isolated concurrency test: " + error.message);
  return client;
}

const [operatorA, operatorB] = await Promise.all([
  authenticatedClient(process.env.OPERATOR_A_EMAIL, process.env.OPERATOR_A_PASSWORD),
  authenticatedClient(process.env.OPERATOR_B_EMAIL, process.env.OPERATOR_B_PASSWORD),
]);

const results = await Promise.all([
  operatorA.rpc("approve_booking_and_assign_technician", base),
  operatorB.rpc("approve_booking_and_assign_technician", base),
]);

for (const result of results) {
  assert.equal(result.error, null, result.error?.message);
}
assert.equal(results[0].data, results[1].data, "concurrent exact retries must return one appointment id");

const { count, error } = await operatorA
  .from("booking_appointments")
  .select("id", { count: "exact", head: true })
  .eq("booking_id", process.env.BOOKING_ID);
assert.equal(error, null, error?.message);
assert.equal(count, 1, "concurrent approval must retain exactly one appointment");

console.log("Concurrent approval regression passed: one appointment, one returned id.");
