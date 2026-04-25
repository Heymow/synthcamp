'use client';

import { useEffect } from 'react';

// Root error boundary. Replaces the root layout when active, so it must
// declare its own <html>/<body>. Inline styles only — Tailwind layers from
// globals.css won't be available if the root layout failed to render.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          backgroundColor: '#050507',
          color: '#ffffff',
          fontFamily:
            '"Outfit", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <div
          style={{
            maxWidth: '28rem',
            width: '100%',
            padding: '3rem',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            backdropFilter: 'blur(25px)',
            WebkitBackdropFilter: 'blur(25px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '28px',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem',
          }}
        >
          <h2
            style={{
              fontSize: '1.875rem',
              lineHeight: 1,
              fontWeight: 900,
              fontStyle: 'italic',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            Signal scrambled
          </h2>
          <p
            style={{
              fontSize: '0.875rem',
              fontStyle: 'italic',
              color: 'rgba(255, 255, 255, 0.7)',
              margin: 0,
            }}
          >
            An unexpected error occurred during playback.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              background: '#ffffff',
              color: '#000000',
              border: 'none',
              borderRadius: '1rem',
              padding: '0.75rem 1.5rem',
              fontSize: '0.75rem',
              fontWeight: 900,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Retry
          </button>
          {error.digest ? (
            <p
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '9px',
                color: 'rgba(255, 255, 255, 0.4)',
                margin: 0,
              }}
            >
              {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
