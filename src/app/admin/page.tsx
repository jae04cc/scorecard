"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Shield, Users, Settings, Save, Check, ChevronDown, Globe, AlertCircle, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { cn, formatDateTime } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────
interface AppSettings {
  app_url: string;
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
  app_url: "",
  oidc_enabled: "false",
  oidc_issuer: "",
  oidc_client_id: "",
  oidc_client_secret: "",
  stats_visibility: "global",
  local_admin_username: "",
  has_local_admin: "false",
};

type Tab = "settings" | "users";

// ── Page ───────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("settings");

  // Settings state
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [localPassword, setLocalPassword] = useState("");
  const [localPasswordConfirm, setLocalPasswordConfirm] = useState("");
  const [showBreakGlassForm, setShowBreakGlassForm] = useState(false);
  const [showBreakGlassSection, setShowBreakGlassSection] = useState(false);
  const [showOidcConfig, setShowOidcConfig] = useState(false);

  // Users state
  const [userList, setUserList] = useState<UserRow[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [roleChanging, setRoleChanging] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data: Partial<AppSettings>) => {
        setSettings((prev) => ({ ...prev, ...data }));
        setSettingsLoading(false);
      })
      .catch(() => setSettingsLoading(false));

    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: UserRow[]) => {
        setUserList(Array.isArray(data) ? data : []);
        setUsersLoading(false);
      })
      .catch(() => setUsersLoading(false));
  }, []);

  const set = (key: keyof AppSettings, value: string) =>
    setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSettingsError(null);
    const enabling = settings.oidc_enabled === "true";
    const hasExistingCredentials = settings.has_local_admin === "true";

    if (enabling) {
      if (!settings.local_admin_username.trim() || (!hasExistingCredentials && !localPassword)) {
        setSettingsError("A break-glass account must be configured before saving with authentication enabled.");
        setShowBreakGlassSection(true);
        return;
      }
      if (localPassword && localPassword !== localPasswordConfirm) {
        setSettingsError("Passwords do not match.");
        setShowBreakGlassSection(true);
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = { ...settings };
      if (localPassword) payload.local_admin_password = localPassword;
      delete payload.has_local_admin;

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save settings");

      const updated = await fetch("/api/admin/settings").then((r) => r.json());
      setSettings((prev) => ({ ...prev, ...updated }));
      setLocalPassword("");
      setLocalPasswordConfirm("");
      setShowBreakGlassForm(false);
      setShowBreakGlassSection(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSettingsError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = async (user: UserRow) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    setUsersError(null);
    setRoleChanging(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setUsersError((body as { error?: string }).error ?? "Failed to update role.");
        return;
      }
      setUserList((prev) => prev.map((u) => u.id === user.id ? { ...u, role: newRole } : u));
    } finally {
      setRoleChanging(null);
    }
  };

  const oidcEnabled = settings.oidc_enabled === "true";
  const hasLocalAdmin = settings.has_local_admin === "true";
  const adminCount = userList.filter((u) => u.role === "admin").length;

  const handleOidcToggle = () => {
    const turningOn = !oidcEnabled;
    set("oidc_enabled", turningOn ? "true" : "false");
    if (turningOn) {
      setShowOidcConfig(true);
      setShowBreakGlassSection(true);
    }
  };

  const redirectUri = settings.app_url
    ? `${settings.app_url.replace(/\/$/, "")}/api/auth/callback/oidc`
    : "[your-app-url]/api/auth/callback/oidc";

  const ToggleButton = ({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-medium transition-colors shrink-0",
        enabled
          ? "border-accent bg-accent/10 text-accent"
          : "border-slate-600 bg-surface text-slate-400"
      )}
    >
      <div className={cn(
        "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
        enabled ? "border-accent bg-accent" : "border-slate-500"
      )}>
        {enabled && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      {enabled ? "On" : "Off"}
    </button>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <header className="flex items-center gap-3 px-5 pt-10 pb-4">
        <button
          onClick={() => router.push("/")}
          className="p-2 rounded-xl text-slate-400 transition-colors"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="text-2xl font-black text-white">Admin</h1>
        <div className="ml-auto">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-xl text-slate-400 transition-colors"
          >
            <Home size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="px-5 pb-4">
        <div className="flex gap-1 bg-surface-card rounded-xl p-1">
          {([
            { id: "settings" as Tab, label: "Settings", icon: Settings },
            { id: "users" as Tab, label: "Users", icon: Users },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition-colors",
                activeTab === id
                  ? "bg-surface-elevated text-white"
                  : "text-slate-500"
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Settings tab ── */}
      {activeTab === "settings" && (
        <>
          <main className="flex-1 px-5 pb-10 space-y-8">

            {/* General */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={14} className="text-slate-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">General</h2>
              </div>
              <div className="bg-surface-card rounded-2xl px-4 py-4">
                <Input
                  label="App URL"
                  placeholder="https://sc.example.com"
                  value={settings.app_url}
                  onChange={(e) => set("app_url", e.target.value)}
                  autoComplete="off"
                  hint="The public URL of this app. Required for authentication callbacks."
                />
              </div>
            </section>

            {/* Authentication */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} className="text-slate-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Authentication</h2>
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
                    onToggle={handleOidcToggle}
                  />
                </div>

                {oidcEnabled && (
                  <>
                    {/* OIDC config — collapsible */}
                    <div className="bg-surface-card rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowOidcConfig((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      >
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                          OIDC Provider
                        </div>
                        <ChevronDown
                          size={14}
                          className={cn("text-slate-500 transition-transform", showOidcConfig && "rotate-180")}
                        />
                      </button>

                      {showOidcConfig && (
                        <div className="px-4 pb-4 space-y-4 border-t border-slate-700/50 pt-4">
                          <Input
                            label="Issuer URL"
                            placeholder="https://auth.yourdomain.com/application/o/app/"
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
                          <div className="bg-surface/60 rounded-xl px-3 py-3 border border-slate-700/50">
                            <p className="text-xs text-slate-500 leading-relaxed">
                              Set the redirect URI in your OIDC provider to{" "}
                              <span className={cn(
                                "font-mono break-all",
                                settings.app_url ? "text-slate-300" : "text-slate-600 italic"
                              )}>
                                {redirectUri}
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Break-glass account — collapsible */}
                    <div className="bg-surface-card rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowBreakGlassSection((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      >
                        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                          Break-glass Account
                        </div>
                        <div className="flex items-center gap-2">
                          {!showBreakGlassSection && (
                            hasLocalAdmin
                              ? <span className="flex items-center gap-1 text-xs text-success"><Check size={11} />Configured</span>
                              : <span className="flex items-center gap-1 text-xs text-amber-500"><AlertCircle size={11} />Not set</span>
                          )}
                          <ChevronDown
                            size={14}
                            className={cn("text-slate-500 transition-transform", showBreakGlassSection && "rotate-180")}
                          />
                        </div>
                      </button>

                      {showBreakGlassSection && (
                        <div className="px-4 pb-4 space-y-3 border-t border-slate-700/50 pt-4">
                          <p className="text-xs text-slate-600">
                            Local admin login that works even if SSO is misconfigured.
                          </p>

                          {hasLocalAdmin && !showBreakGlassForm && (
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20 flex-1">
                                <Check size={13} className="text-success shrink-0" />
                                <span className="text-xs text-success">
                                  Configured — username: <span className="font-mono">{settings.local_admin_username}</span>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowBreakGlassForm(true);
                                  setLocalPassword("");
                                  setLocalPasswordConfirm("");
                                }}
                                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-600 text-xs text-slate-400 transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          )}

                          {(!hasLocalAdmin || showBreakGlassForm) && (
                            <div className="space-y-3">
                              <Input
                                label="Username"
                                placeholder="admin"
                                value={settings.local_admin_username}
                                onChange={(e) => set("local_admin_username", e.target.value)}
                                autoComplete="off"
                              />
                              <Input
                                label={hasLocalAdmin ? "New Password (leave blank to keep current)" : "Password"}
                                type="password"
                                placeholder={hasLocalAdmin ? "••••••••" : "Set a strong password"}
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
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* App Settings */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Settings size={14} className="text-slate-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">App Settings</h2>
              </div>
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
                          : "border-slate-600 bg-surface text-slate-400"
                      )}
                    >
                      {v === "global" ? "Everyone" : "Per User"}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {settingsError && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">
                {settingsError}
              </div>
            )}
          </main>

          <footer className="px-5 pb-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom, 2rem))" }}>
            <Button size="lg" onClick={handleSave} loading={saving} disabled={settingsLoading}>
              {saved ? (
                <><Check size={16} />Saved</>
              ) : (
                <><Save size={16} />Save Settings</>
              )}
            </Button>
          </footer>
        </>
      )}

      {/* ── Users tab ── */}
      {activeTab === "users" && (
        <main className="flex-1 px-5 pb-10">
          {usersLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-accent border-t-transparent" />
            </div>
          ) : userList.length === 0 ? (
            <div className="bg-surface-card rounded-2xl px-4 py-8 flex flex-col items-center text-center gap-2">
              <Users size={28} className="text-slate-700 mb-1" />
              <p className="text-slate-400 text-sm font-medium">No users yet</p>
              <p className="text-slate-600 text-xs max-w-xs">
                Enable authentication and sign in to create the first admin account.
              </p>
            </div>
          ) : (
            <div className="bg-surface-card rounded-2xl overflow-hidden divide-y divide-slate-700/50">
              {userList.map((user) => {
                const isLastAdmin = user.role === "admin" && adminCount === 1;
                return (
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
                      onClick={() => !isLastAdmin && handleRoleToggle(user)}
                      disabled={roleChanging === user.id || isLastAdmin}
                      title={isLastAdmin ? "Cannot demote the last admin" : undefined}
                      className={cn(
                        "shrink-0 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
                        isLastAdmin
                          ? "border-slate-700 text-slate-600 cursor-not-allowed"
                          : user.role === "admin"
                            ? "border-slate-600 text-slate-400"
                            : "border-slate-600 text-slate-400",
                        roleChanging === user.id && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {user.role === "admin" ? "Demote" : "Promote"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {usersError && (
            <div className="mt-4 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-danger text-sm">
              {usersError}
            </div>
          )}
        </main>
      )}
    </div>
  );
}
