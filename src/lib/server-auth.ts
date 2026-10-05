import { auth } from "@/lib/auth";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session.user;
}

export async function requirePermission(permission: string) {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.permissions?.split(",").map((value) => value.trim()).includes(permission)) {
    throw new Error("Forbidden");
  }
  return user;
}
