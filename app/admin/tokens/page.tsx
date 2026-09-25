"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";

type UserToken = {
  id: string;
  name: string;
  phoneNumber: string;
  hasToken: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  randomId: string | null;
  enrolledBatches: number;
  lastUpdated: string;
};

export default function AdminTokensPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserToken[]>([]);
  const [search, setSearch] = useState("");
  const [reveal, setReveal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [globalToken, setGlobalToken] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        fetch(`/api/admin/user-tokens?search=${encodeURIComponent(search)}&reveal=${reveal ? 1 : 0}`, {
          credentials: "include",
        }),
        fetch("/api/admin/global-token", { credentials: "include" }),
      ]);
      if (uRes.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const uData = await uRes.json();
      setUsers(uData.users || []);
      setGlobalToken(await tRes.json());
    } catch {
      toast.error("Could not load tokens");
    } finally {
      setLoading(false);
    }
  }, [search, reveal, router]);

  useEffect(() => {
    load();
  }, [load]);

  const copy = async (value?: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast.success("Copied");
  };

  return (
    <AdminLayout activePage="tokens">
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-1">Tokens</h1>
            <p className="text-muted-foreground">
              Global token used in guest mode, and the tokens saved for users who logged in.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setReveal((r) => !r)}>
              {reveal ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {reveal ? "Hide" : "Reveal"}
            </Button>
            <Button variant="outline" className="gap-2" onClick={load}>
              <RefreshCw className="w-4 h-4" /> Refresh
            </Button>
          </div>
        </div>

        <Card className="p-5 space-y-2">
          <h2 className="font-semibold text-lg">Global token (guest mode)</h2>
          <div className="text-sm grid gap-1">
            <div>
              Status:{" "}
              <span className={globalToken?.fresh ? "text-green-600" : "text-red-600"}>
                {globalToken?.hasToken ? (globalToken?.fresh ? "Active" : "Expired / needs refresh") : "Not fetched yet"}
              </span>
            </div>
            <div className="break-all">Source: {globalToken?.tokenUrl}</div>
            <div>Token: {globalToken?.preview || "—"}</div>
            <div>
              Fetched: {globalToken?.fetchedAt ? new Date(globalToken.fetchedAt).toLocaleString() : "—"} · Expires:{" "}
              {globalToken?.expiresAt ? new Date(globalToken.expiresAt).toLocaleString() : "unknown"}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <Input
            placeholder="Search user by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Access token</th>
                <th className="p-3">Refresh token</th>
                <th className="p-3">Batches</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-4" colSpan={5}>
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && users.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={5}>
                    No logged-in users yet. Turn Login Mode ON in Controls to collect user tokens.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t align-top">
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.phoneNumber}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-start gap-2">
                      <code className="break-all max-w-[280px] inline-block">{u.accessToken || "—"}</code>
                      {u.accessToken && (
                        <button onClick={() => copy(u.accessToken)}>
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-start gap-2">
                      <code className="break-all max-w-[220px] inline-block">{u.refreshToken || "—"}</code>
                      {u.refreshToken && (
                        <button onClick={() => copy(u.refreshToken)}>
                          <Copy className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="p-3">{u.enrolledBatches}</td>
                  <td className="p-3">{u.lastUpdated ? new Date(u.lastUpdated).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AdminLayout>
  );
}
