export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "eugene.eee@iskra.world";

export function isAdmin(email: string) {
  return email === ADMIN_EMAIL;
}
