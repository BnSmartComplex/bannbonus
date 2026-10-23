"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";

type StaffRole = "tenant_admin" | "operator" | "technician";

export function StaffNavLinks() {
  const [roles, setRoles] = useState<StaffRole[]>([]);

  useEffect(() => {
    let active = true;
    const supabase = getSupabase();
    if (!supabase) return;

    void (async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active || authError || !user) return;
      const { data, error } = await supabase.from("tenant_memberships")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["tenant_admin", "operator", "technician"]);
      if (!active || error) return;
      setRoles((data ?? []).map(row => row.role).filter(
        (role): role is StaffRole => role === "tenant_admin" || role === "operator" || role === "technician",
      ));
    })();

    return () => { active = false; };
  }, []);

  const canManage = roles.includes("tenant_admin") || roles.includes("operator");
  const isTechnician = roles.includes("technician");

  return <>
    {roles.length > 0 && <Link href="/">หน้าหลักทีมงาน</Link>}
    {canManage && <Link href="/operator/bookings">Admin / จัดการงาน</Link>}
    {isTechnician && <Link href="/technician/jobs">งานช่าง</Link>}
    {canManage && <Link href="/staff">ศูนย์รับงาน</Link>}
  </>;
}
