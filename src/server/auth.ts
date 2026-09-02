import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { prisma } from "./db";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "mellow_session";
const SESSION_DAYS = 14;

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { team: true } } },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }

  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    throw new Error("Admin permission required");
  }
  return user;
}

export async function createSession(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await prisma.session.create({
    data: {
      token,
      userId: user.id,
      expiresAt,
    },
  });

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  return user;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  store.delete(COOKIE_NAME);
}

export function canEditTask(user: { id: string; role: UserRole; teamId: string | null }, task: { assignedUserId: string | null; assignedTeamId: string | null }) {
  return user.role === UserRole.ADMIN || task.assignedUserId === user.id || (!!user.teamId && task.assignedTeamId === user.teamId);
}

export function canViewClient(user: { id: string; role: UserRole; teamId: string | null }, client: { ownerId: string | null; teamId: string | null }) {
  return user.role === UserRole.ADMIN || client.ownerId === user.id || (!!user.teamId && client.teamId === user.teamId);
}
