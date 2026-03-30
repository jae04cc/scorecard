"use client";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // Don't show if user already dismissed this session
    if (sessionStorage.getItem("pwa-dismissed")) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted" || outcome === "dismissed") {
      setPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-dismissed", "1");
  };

  if (!prompt || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-lg z-50">
      <div className="bg-surface-card border border-slate-600 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-xl">
        <Download size={18} className="text-accent shrink-0" />
        <p className="flex-1 text-sm text-slate-200">
          Add <span className="font-semibold">Scorecard</span> to your home screen
        </p>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90 transition-colors shrink-0"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
