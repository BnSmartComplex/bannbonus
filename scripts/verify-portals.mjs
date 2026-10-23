import assert from "node:assert/strict";

const customer = new URL(process.env.CUSTOMER_PORTAL_URL || "https://chang24.vercel.app");
const staff = new URL(process.env.STAFF_PORTAL_URL || "https://bannbonus.vercel.app");
let failures = 0;

async function check(label, run) {
  try {
    await run();
    console.log(`PASS ${label}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${label}: ${error.message}`);
  }
}

async function request(base, path) {
  return fetch(new URL(path, base), {
    redirect: "manual",
    signal: globalThis.AbortSignal.timeout(15000),
    headers: { "Cache-Control": "no-cache" },
  });
}

for (const [name, base] of [["CUSTOMER", customer], ["STAFF", staff]]) {
  await check(`${name} homepage`, async () => {
    const response = await request(base, "/");
    assert.equal(response.status, 200);
    const html = await response.text();
    if (name === "CUSTOMER") {
      assert.ok(!/href=["']\/(staff|operator|technician)(?:[/"'?])/.test(html), "customer navigation contains a staff link");
      assert.ok(/href=["']\/booking(?:[/"'?])/.test(html), "customer booking link is missing");
    } else {
      assert.ok(/name=["']robots["'][^>]*content=["'][^"']*noindex/.test(html), "staff noindex metadata is missing");
      assert.ok(/href=["']\/operator\/bookings["']/.test(html), "staff bookings link is missing");
    }
  });
}

for (const [name, base, paths] of [
  ["CUSTOMER", customer, ["/staff", "/operator/bookings", "/technician/jobs"]],
  ["STAFF", staff, ["/booking", "/my-bookings", "/pricing"]],
]) {
  for (const path of paths) {
    await check(`${name} blocks ${path}`, async () => {
      const response = await request(base, path);
      assert.equal(response.status, 307);
      assert.equal(new URL(response.headers.get("location"), base).href, new URL("/", base).href);
    });
  }
}

for (const path of ["/api/route-distance", "/api/realtime-window"]) {
  await check(`STAFF blocks ${path}`, async () => {
    const response = await request(staff, path);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, "NOT_FOUND");
  });
}

console.log(`${failures} failed portal checks. These checks do not verify database authorization or booking writes.`);
process.exitCode = failures ? 1 : 0;
