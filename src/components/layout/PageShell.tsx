'use client';

// ============================================================
// PAGE SHELL — Content wrapper for top-level pages
// Navbar is provided by layout.tsx (applies to all routes)
// This just handles consistent max-width + padding
// ============================================================

interface PageShellProps {
  children: React.ReactNode;
  // These are accepted but unused here — kept for API compatibility
  lastFetch?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <main className="max-w-screen-2xl mx-auto px-3 sm:px-4 py-4 pb-6">
      {children}
    </main>
  );
}
