"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Link2, RefreshCw, Save, ShieldCheck } from "lucide-react";

export default function AdminControlsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [token, setToken] = useState<any>(null);
  const [tests, setTests] = useState<any[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [testingSource, setTestingSource] = useState(false);
  const [sourceResult, setSourceResult] = useState<any>(null);

  const testBatchesSource = async () => {
    setTestingSource(true);
    setSourceResult(null);
    try {
      const res = await fetch("/api/admin/test-batches-source", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: settings?.batchesSourceUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Link test failed");
      setSourceResult(data);
      toast.success(`Link OK — ${data.count} batches found`);
    } catch (err: any) {
      setSourceResult({ success: false, message: err.message });
      toast.error(err.message || "Link test failed");
    } finally {
      setTestingSource(false);
    }
  };

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings", { credentials: "include" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = await res.json();
    setSettings(data.settings);
    setToken(data.token);
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (patch: any) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      setSettings(data.settings);
      toast.success("Saved");
    } catch (err: any) {
      toast.error(err.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const refreshToken = async (withTests: boolean) => {
    setRefreshing(true);
    setTests(null);
    try {
      const res = await fetch(`/api/admin/global-token?test=${withTests ? 1 : 0}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Refresh failed");
      setToken(data.status);
      setTests(data.tests || null);
      toast.success("Token refreshed");
    } catch (err: any) {
      toast.error(err.message || "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  if (!settings) {
    return (
      <AdminLayout activePage="controls">
        <div className="p-8">Loading…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activePage="controls">
      <div className="p-4 lg:p-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-1">Controls</h1>
          <p className="text-muted-foreground">Login mode, branding and the token source.</p>
        </div>

        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold text-lg">Login mode</h2>
              <p className="text-sm text-muted-foreground">
                OFF = guests browse with the automatic StudySpark token. ON = visitors log in with their own
                account and their token is used for all API calls.
              </p>
            </div>
            <Switch
              checked={Boolean(settings.loginEnabled)}
              onCheckedChange={(v) => save({ loginEnabled: v })}
              disabled={saving}
            />
          </div>
          <div className="text-sm">
            Current mode:{" "}
            <span className="font-semibold">{settings.loginEnabled ? "Login ON" : "Guest mode (login OFF)"}</span>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Branding</h2>
          <div className="space-y-2">
            <Label>App name</Label>
            <Input value={settings.appName} onChange={(e) => setSettings({ ...settings, appName: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Telegram link</Label>
            <Input
              value={settings.telegramLink}
              onChange={(e) => setSettings({ ...settings, telegramLink: e.target.value })}
            />
          </div>
          <Button
            className="gap-2"
            disabled={saving}
            onClick={() => save({ appName: settings.appName, telegramLink: settings.telegramLink })}
          >
            <Save className="w-4 h-4" /> Save branding
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Batches source URL</h2>
          <p className="text-sm text-muted-foreground">
            JSON link that supplies the batches shown on the Batches page. Change it any time — the site picks
            up the new list immediately. Batches without an image get the default PW-MARCO banner.
          </p>
          <div className="space-y-2">
            <Label>JSON URL</Label>
            <Input
              value={settings.batchesSourceUrl || ""}
              onChange={(e) => setSettings({ ...settings, batchesSourceUrl: e.target.value })}
              placeholder="https://raw.githubusercontent.com/.../batches.json"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="gap-2"
              disabled={saving}
              onClick={() => save({ batchesSourceUrl: settings.batchesSourceUrl })}
            >
              <Save className="w-4 h-4" /> Save batches link
            </Button>
            <Button variant="outline" className="gap-2" disabled={testingSource} onClick={testBatchesSource}>
              <Link2 className="w-4 h-4" /> {testingSource ? "Testing..." : "Test link"}
            </Button>
          </div>
          {sourceResult && (
            <div className="text-sm pt-2 border-t space-y-1">
              {sourceResult.success ? (
                <>
                  <div className="text-green-600">{sourceResult.count} batches loaded</div>
                  <ul className="text-muted-foreground list-disc pl-5">
                    {sourceResult.sample?.map((b: any) => (
                      <li key={b.id}>{b.name}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <div className="text-red-600">{sourceResult.message}</div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Primary lecture API</h2>
          <p className="text-sm text-muted-foreground">
            Lecture streams are fetched from the primary API first, then from the fallback API, and only
            then from the built-in resolver. Each must be an https:// URL containing the
            {" {batch_id} "}, {"{subject_id} "} and {"{lecture_id} "} placeholders ({"{topic_id} "} is optional).
          </p>
          <div className="space-y-2">
            <Label>API template</Label>
            <Input
              value={settings.primaryStreamApi || ""}
              onChange={(e) => setSettings({ ...settings, primaryStreamApi: e.target.value })}
              placeholder="https://example.com/api/{batch_id}/{subject_id}/{lecture_id}"
            />
          </div>
          <div className="space-y-2">
            <Label>Fallback API template</Label>
            <Input
              value={settings.fallbackStreamApi || ""}
              onChange={(e) => setSettings({ ...settings, fallbackStreamApi: e.target.value })}
              placeholder="https://example.com/api/{batch_id}/{subject_id}/{topic_id}/{lecture_id}"
            />
          </div>
          <Button
            className="gap-2"
            disabled={saving}
            onClick={() =>
              save({
                primaryStreamApi: settings.primaryStreamApi,
                fallbackStreamApi: settings.fallbackStreamApi,
              })
            }
          >
            <Save className="w-4 h-4" /> Save lecture APIs
          </Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Global token source</h2>
          <div className="space-y-2">
            <Label>Token URL</Label>
            <Input value={settings.tokenUrl} onChange={(e) => setSettings({ ...settings, tokenUrl: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Manual token (optional — overrides the URL above)</Label>
            <Input
              value={settings.manualToken}
              placeholder="Paste a token from another source"
              onChange={(e) => setSettings({ ...settings, manualToken: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={saving}
              className="gap-2"
              onClick={() => save({ tokenUrl: settings.tokenUrl, manualToken: settings.manualToken })}
            >
              <Save className="w-4 h-4" /> Save token settings
            </Button>
            <Button variant="outline" className="gap-2" disabled={refreshing} onClick={() => refreshToken(false)}>
              <RefreshCw className="w-4 h-4" /> Refresh token
            </Button>
            <Button variant="outline" className="gap-2" disabled={refreshing} onClick={() => refreshToken(true)}>
              <ShieldCheck className="w-4 h-4" /> Refresh &amp; test APIs
            </Button>
          </div>

          <div className="text-sm space-y-1 pt-2 border-t">
            <div>
              Status:{" "}
              <span className={token?.fresh ? "text-green-600" : "text-red-600"}>
                {token?.hasToken ? (token?.fresh ? "Active" : "Expired / needs refresh") : "Not fetched yet"}
              </span>
            </div>
            <div>Token: {token?.preview || "—"}</div>
            <div>Expires: {token?.expiresAt ? new Date(token.expiresAt).toLocaleString() : "unknown"}</div>
          </div>

          {tests && (
            <div className="text-sm space-y-1 pt-2 border-t">
              <div className="font-medium">API test results</div>
              {tests.map((t) => (
                <div key={t.name}>
                  {t.ok ? "✅" : "❌"} {t.name} — HTTP {t.status}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
