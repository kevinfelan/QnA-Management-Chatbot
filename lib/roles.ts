import type { User } from "@supabase/supabase-js";

export type Role = "admin" | "user";

export function getRole(user: User | null | undefined): Role {
  return user?.app_metadata?.role === "admin" ? "admin" : "user";
}

export function isAdmin(user: User | null | undefined): boolean {
  return getRole(user) === "admin";
}
