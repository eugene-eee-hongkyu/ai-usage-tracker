const raw = process.env.ADMIN_EMAIL ?? "eugene.eee@iskra.world";
const ADMIN_EMAILS = new Set(raw.split(",").map((e) => e.trim()).filter(Boolean));

export function isAdmin(email: string) {
  return ADMIN_EMAILS.has(email);
}
