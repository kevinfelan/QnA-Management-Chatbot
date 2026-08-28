import type { User } from "@supabase/supabase-js";

function formatFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function getDisplayName(user: User | null | undefined): string {
  if (!user) return "";

  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim();
  }

  return user.email ? formatFromEmail(user.email) : "";
}
