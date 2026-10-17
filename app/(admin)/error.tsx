"use client";

import { AlertIcon } from "@/components/icons";

/**
 * A page that didn't load. "Try again" fetches it again; "Reload page" starts the whole page afresh
 * (what fixes it when the browser holds an older copy of the admin than the server has). While
 * developing, the error itself shows too, to say what went wrong.
 */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="panel empty-state">
      <span className="empty-state__icon">
        <AlertIcon />
      </span>
      <h2>This page didn&apos;t load</h2>
      <p>Try again. If it still doesn&apos;t load, reload the page.</p>
      <div className="row-end">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => window.location.reload()}>
          Reload page
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={retry}>
          Try again
        </button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <pre className="error-detail">
          {error.name}: {error.message}
          {error.digest && `\n(digest ${error.digest})`}
        </pre>
      )}
      {process.env.NODE_ENV !== "development" && error.digest && <p className="field__hint">Error code: {error.digest}</p>}
    </section>
  );
}
