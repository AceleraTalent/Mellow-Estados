"use client";

import { useActionState } from "react";
import Image from "next/image";
import { LogIn } from "lucide-react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <main className="login-page">
      <form action={action} className="login-card">
        <div className="login-logo">
          <Image src="/mellow-logo.png" alt="Mellow & Banana" width={260} height={40} priority />
        </div>
        <h1 style={{ margin: "18px 0 0" }}>Client Operations</h1>
        <p className="muted">Sign in to manage client delivery.</p>
        <div className="grid" style={{ marginTop: 18 }}>
          <label>
            Email
            <input className="input" name="email" type="email" required style={{ width: "100%", marginTop: 6 }} />
          </label>
          <label>
            Password
            <input className="input" name="password" type="password" required style={{ width: "100%", marginTop: 6 }} />
          </label>
          {state?.error ? <p style={{ color: "var(--danger)", margin: 0 }}>{state.error}</p> : null}
          <button className="button" type="submit" disabled={pending}>
            <LogIn size={16} /> {pending ? "Signing in..." : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
