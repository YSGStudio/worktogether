import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  // 비대칭 서명 키(ES256)라 JWT를 서버에서 바로 검증한다(Auth 서버 왕복 없음)
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name, class_id")
    .eq("id", userId)
    .maybeSingle();
  return (profile as Profile | null) ?? null;
});

export async function requireUser(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/student-login");
  return profile;
}

export async function requireTeacher(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "teacher") redirect("/home");
  return profile;
}

export async function requireStudent(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect("/student-login");
  if (profile.role !== "student") redirect("/teacher");
  return profile;
}
