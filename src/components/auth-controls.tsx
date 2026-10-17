"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

export function AuthControls() {
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSignedIn(Boolean(session));
    });
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) setSignedIn(Boolean(session));
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (!error) {
      setSignedIn(false);
      window.location.assign("/login");
    }
  }

  return signedIn
    ? <button className="btn" type="button" disabled={busy} onClick={() => void signOut()}>
        {busy ? "กำลังออก…" : "ออกจากระบบ"}
      </button>
    : <Link href="/login">เข้าสู่ระบบ</Link>;
}
