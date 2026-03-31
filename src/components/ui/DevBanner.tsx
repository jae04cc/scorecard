"use client";

export function DevBanner() {
  const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_APP_ENV === "dev";
  if (!isDev) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning text-black text-xs font-bold text-center py-0.5 tracking-widest uppercase">
      Dev
    </div>
  );
}
