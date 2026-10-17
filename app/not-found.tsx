import Link from "next/link";
import { I8Mark } from "@/components/I8Mark";

export default function NotFound() {
  return (
    <main className="signin">
      <div className="signin__bg" aria-hidden="true"></div>
      <div className="signin__card">
        <I8Mark className="signin__mark" />
        <h1>Not here</h1>
        <p className="signin__lead">This page doesn&apos;t exist, or it was removed.</p>
        <Link href="/" className="btn btn--primary btn--sm">
          Back to the admin
        </Link>
      </div>
    </main>
  );
}
