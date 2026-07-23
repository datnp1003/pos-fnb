"use client";

import { useState, useEffect, useTransition } from "react";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import Image from "next/image";
import { useI18n } from "@/i18n/context";
import { LanguageSwitcher } from "@/i18n/language-switcher";

export default function LoginPage() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ username: "", password: "" });
  // data-hydrated é setado pelo useEffect — nunca existe no HTML do SSR.
  // O k6/browser espera por esse atributo antes de clicar em submit,
  // garantindo que o React montou e o onSubmit está registrado.
  const [hydrated, setHydrated] = useState(false);
  // Seta data-hydrated no form assim que o React monta no cliente.
  // O atributo nunca existe no HTML do SSR, então é um indicador confiável
  // de que o onSubmit já está registrado — usado pelo k6/browser test.
  useEffect(() => {
    const timer = setTimeout(() => setHydrated(true), 0);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await signIn("credentials", {
        username: form.username,
        password: form.password,
        redirect: false,
      });
      if (res?.error) {
        toast.error(t.login.wrongCredentials);
        return;
      }
      // Redirect to first accessible module based on session scopes
      globalThis.location.href = "/order";
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-amber-50 via-white to-orange-50">

      {/* Language switcher */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        {/* Logo + Brand */}
        <div className="mb-8 text-center">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-lg border border-amber-100 flex items-center justify-center mx-auto mb-4 overflow-hidden">
            <Image src="/logo.png" alt="Logo" width={64} height={64} className="object-cover" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">POS F&B</h1>
          <p className="text-sm text-gray-500 mt-1.5">{t.login.tagline}</p>
        </div>

        {/* Login form */}
        <div className="w-full max-w-sm">
          <form
            data-testid="login-form"
            data-hydrated={hydrated ? "true" : undefined}
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-lg shadow-amber-100/50 border border-gray-100 p-6 space-y-5"
          >
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700">{t.login.username}</label>
              <input
                data-testid="login-username"
                name="username"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
                placeholder={t.login.usernamePlaceholder}
                autoComplete="username"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-gray-700">{t.login.password}</label>
                <button type="button" className="text-xs font-medium text-amber-600 hover:text-amber-700">{t.login.forgotPassword}</button>
              </div>
              <input
                data-testid="login-password"
                name="password"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 outline-none transition-all text-sm"
                placeholder={t.login.passwordPlaceholder}
                autoComplete="current-password"
              />
            </div>

            <button
              data-testid="login-submit"
              type="submit"
              disabled={pending}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-xl font-bold text-sm shadow-md shadow-amber-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {pending ? t.login.loggingIn : t.login.login}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            {t.login.systemLabel} · v1.1
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} {t.login.copyright}
      </div>
    </div>
  );
}
