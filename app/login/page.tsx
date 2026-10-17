/* eslint-disable @next/next/no-img-element -- the INNEV8 logo is an SVG, already sized */
import type { Metadata } from "next";
import { SignInForm } from "@/components/AuthForms";
import { LockIcon } from "@/components/icons";
import { RegionMap } from "@/components/RegionMap";

export const metadata: Metadata = { title: "Sign in" };

/** Signing in: the form on the left; on the right, Eastern Visayas connecting (the main site's closing scene). */
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  return (
    <main className="auth">
      <section className="auth__side">
        <div className="auth__form">
          <img
            className="auth__logo"
            src="/assets/img/logo/innev8-logo-horizontal-reversed.svg"
            alt="INNEV8 ICT Federation"
            width="689"
            height="236"
          />
          <p className="eyebrow">Organisers only</p>
          <h1>
            QR Hunt <span className="grad">Admin</span>
          </h1>
          <p className="auth__lead">QR codes, clues, prizes and the event, for the Regional ICT Summit 2026.</p>
          {/* Signing in needs the secret key too (it counts wrong passwords): say so instead of failing */}
          {process.env.SUPABASE_SECRET_KEY ? (
            <SignInForm next={typeof next === "string" ? next : "/"} />
          ) : (
            <p className="status status--error" role="alert">
              Setup isn&apos;t finished: paste the secret key after SUPABASE_SECRET_KEY= in .env.local, then restart
              the admin.
            </p>
          )}
          <p className="signin__note">
            <LockIcon />
            Only the INNEV8 team can sign in. Need access? Ask an admin to add you.
          </p>
        </div>
        <p className="auth__foot">© 2026 INNEV8 ICT Federation</p>
      </section>

      <section className="auth-art is-live is-playing" aria-hidden="true">
        <RegionMap />
        <div className="auth-art__copy">
          <p className="auth-art__eyebrow">Six provinces · One region · Nov 20–21</p>
          <p className="auth-art__big">
            <span>Eastern Visayas</span>
            <span className="grad">is about to connect.</span>
          </p>
        </div>
      </section>
    </main>
  );
}
