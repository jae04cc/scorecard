"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Users, Settings, Save, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDateTime } from "@/lib/utils";

interface AppSettings {
  oidc_enabled: string;
  oidc_issuer: string;
  oidc_client_id: string;
  oidc_client_secret: string;
  stats_visibility: string;
  local_admin_username: string;
  has_local_admin: string;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  createdAt: number;
  lastLoginAt: number | null;
}

const DEFAULTS: AppSettings = {
  oidc_enabled: "false",
  oidc_issuer: "",
  oidc_client_id: "",
  oidc_client_secret: "",
  stats_visibility: "global",
  local_admin_username: "",
  has_local_admin: "false",
};

export default function AdminPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userList, setUserList] = useState<UserRow[]>([]);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [localPassword, setLocalPassword] = useState("");
  const [localPasswordConfirm, setLocalPasswordConfirm] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
    ]).then(([settingsData, usersData]: [Partial<AppSettings>, UserRow[]]) => {
      setSettings((prev) => ({ ...prev, ...settingsData }));
      setUserList(Array.isArray(usersData) ? usersData : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleRoleToggle = async (user: UserRow) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    setRoleChanging(user.id);
    try {
      await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      setUserList((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    } finally {
      setRoleChanging(null);
    }
  };

  const set = (key: keyof AppSettings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setError(null);

    const enabling = settings.oidc_enabled === "true";
    const hasExistingCredentials = settings.has_local_admin === "true";

    // Validate break-glass credentials when enabling auth
    if (enabling) {
      if (!settings.local_admin_username.trim()) {
        setError("A break-glass username is required when enabling authentication.");
        return;
      }
      if (!hasExistingCredentials && !localPassword) {
        setError("A break-glass password is required when enabling authentication for the first time.");
        return;
      }
      if (localPassword && localPassword !== localPasswordConfirm) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = { ...settings };
      if (localPassword) payload.local_admin_password = localPassword;
      // Never send these synthetic/read-only fields back
      delete payload.has_local_admin;

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save settings");

      // Refetch to get updated has_local_admin flag
      const updated = await fetch("/api/admin/settings").then((r) => r.json());
      setSettings((prev) => ({ ...prev, ...updated }));
      setLocalPassword("");
      setLocalPasswordConfirm("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const oidcEnabled = settings.oidc_enabled === "true";

  const ToggleButton = ({
    enabled,
    onToggle,
  }: {
    enabled: boolean;
    onToggle: () => void;
  }) => (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors shrink-0",
        enabled
          ? "border-accent bg-accent/10 text-accent"
          : "border-slate-600 bg-surface text-slate-400 hover:border-slate-500"
      )}
    >
      <div
        className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
          enabled ? "border-accent bg-accent" : "border-slate-500"
        )}
      >
        {enabled && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path
              d="M1 3L3 5L7 1"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
      {enabled ? "On" : "Off"}
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 px-5 pt-10 pb-6">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-xl hover:bg-surface-card text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-white">Admin</h1>
      </header>

      <main className="flex-1 px-5 pb-10 space-y-8">

        {/* ── Authentication ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Authentication
            </h2>
          </div>
          <div className="space-y-3">

            {/* Enable toggle */}
            <div className="bg-surface-card rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-200 text-sm">Enable Authentication</div>
                <div className="text-xs text-slate-500">Require users to log in to access the app</div>
              </div>
              <ToggleButton
                enabled={oidcEnabled}
                onToggle={() => set("oidc_enabled", oidcEnabled ? "false" : "true")}
              />
            </div>

            {/* OIDC config */}
            {oidcEnabled && (
              <>
                <div className="bg-surface-card rounded-2xl px-4 py-4 space-y-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    OIDC Provider
                  </div>
                  <Input
                    label="Issuer URL"
                    placeholder="https://auth.yourdomain.com/application/o/scorecard/"
                    value={settings.oidc_issuer}
                    onChange={(e) => set("oidc_issuer", e.target.value)}
                    autoComplete="off"
                  />
                  <Input
                    label="Client ID"
                    placeholder="your-client-id"
                    value={settings.oidc_client_id}
                    onChange={(e) => set("oidc_client_id", e.target.value)}
                    autoComplete="off"
                  />
                  <Input
                    label="Client Secret"
                    type="password"
                    placeholder="your-client-secret"
                    value={settings.oidc_client_secret}
                    onChange={(e) => set("oidc_client_secret", e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div className="bg-surface-card/40 rounded-xl px-4 py-3 border border-slate-700/50">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Set the redirect URI in your OIDC provider to{" "}
                    <span className="text-slate-300 font-mono break-all">
                      [your-app-url]/api/auth/callback/oidc
                    </span>
                  </p>
                </div>
              </>
            )}

            {/* Break-glass local admin — always required when auth is enabled */}
            {oidcEnabled && (
              <div className="bg-surface-card rounded-2xl px-4 py-4 space-y-4">
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                    Break-glass Account
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    A local admin account that always works, even if SSO is misconfigured.
                  </p>
                </div>
                {settings.has_local_admin === "true" && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20">
                    <Check size={13} className="text-success shrink-0" />
                    <span className="text-xs text-success">Break-glass account is configured</span>
                  </div>
                )}
                <Input
                  label="Username"
                  placeholder="admin"
                  value={settings.local_admin_username}
                  onChange={(e) => set("local_admin_username", e.target.value)}
                  autoComplete="off"
                />
                <Input
                  label={settings.has_local_admin === "true" ? "New Password (leave blank to keep current)" : "Password"}
                  type="password"
                  placeholder={settings.has_local_admin === "true" ? "••••••••" : "Set a strong password"}
                  value={localPassword}
                  onChange={(e) => setLocalPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {localPassword && (
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Re-enter password"
                    value={localPasswordConfirm}
                    onChange={(e) => setLocalPasswordConfirm(e.target.value)}
                    autoComplete="new-password"
                    error={localPasswordConfirm && localPassword !== localPasswordConfirm ? "Passwords do not match" : undefined}
                  />
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Settings ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Settings size={14} className="text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Settings
            </h2>
          </div>
          <div className="space-y-3">
            <div className="bg-surface-card rounded-2xl px-4 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="font-medium text-slate-200 text-sm">Stats Page Visibility</div>
                <div className="text-xs text-slate-500">
                  {settings.stats_visibility === "global"
                    ? "Everyone can see the full leaderboard"
                    : "Users only see their own stats"}
                </div>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {(["global", "scoped"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set("stats_visibility", v)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors",
                      settings.stats_visibility === v
                        ? "border-accent bg-accent/10 text-white"
                        : "border-slate-600 bg-surface text-slate-400 hover:border-slate-500"
                    )}
                  >
                    {v === "global" ? "Everyone" : "Per User"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Users ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users size={14} className="text-slate-500" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Users
            </h2>
          </div>
          {userList.length === 0 ? (
            <div className="bg-surface-card rounded-2xl px-4 py-8 flex flex-col items-center text-center gap-2">
              <Users size={28} className="text-slate-700 mb-1" />
              <p className="text-slate-400 text-sm font-medium">No users yet</p>
              <p className="text-slate-600 text-xs max-w-xs">
                Enable authentication and sign in to create the first admin account.
              </p>
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl overflow-hidden divide-y divide-slate-700/50">
              {userList.map((user) => (
                <div key={user.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-200 text-sm truncate">
                        {user.name ?? "Unknown"}
                      </span>
                      <Badge variant={user.role === "admin" ? "success" : "default"}>
                        {user.role}
                      </Badge>
                    </div>
                    {user.email && (
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                    )}
                    <p className="text-xs text-slate-600 mt-0.5">
                      {user.lastLoginAt
                        ? `Last login: ${formatDateTime(user.lastLoginAt)}`
                        : "Never logged in"}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRoleToggle(user)}
                    disabled={roleChanging === user.id}
                    className={cn(
                      "shrink-0 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
                      user.role === "admin"
                        ? "border-slate-600 text-slate-400 hover:border-danger hover:text-danger"
                        : "border-slate-600 text-slate-400 hover:border-success hover:text-success",
                      roleChanging === user.id && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {user.role === "admin" ? "Demote" : "Promote"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">
            {error}
          </div>
        )}
      </main>

      <footer className="px-5 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}>
        <Button size="lg" onClick={handleSave} loading={saving} disabled={loading}>
          {saved ? (
            <>
              <Check size={16} />
              Saved
            </>
          ) : (
            <>
              <Save size={16} />
              Save Settings
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}
