import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: { index: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg min-h-screen text-white antialiased">{children}</div>
  );
}
