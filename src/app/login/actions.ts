"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/server/auth";

export async function loginAction(_: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await createSession(email, password);

  if (!user) {
    return { error: "Invalid email or password" };
  }

  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
