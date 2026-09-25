"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout from "@/app/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw, Trash2, Users } from "lucide-react";

type GuestBatch = { batchId: string; batchName: string; createdAt: string };
type Guest = {
  id: string;
  label: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  enrolledCount: number;
  batches: GuestBatch[];
};

export default function AdminGuestsPage() {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalEnrollments, setTotalEnrollments] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/guests?page=${page}&limit=20&search=${encodeURIComponent(search)}`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const data = await res.json();
      setGuests(data.guests || []);
      setTotal(data.total || 0);
      setTotalEnrollments(data.totalEnrollments || 0);
    } catch {
      toast.error("Could not load guest sessions");
    } finally {
      setLoading(false);
    }
  }, [page, search, router]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this guest session and its enrolled batches?")) return;
    const res = await fetch(`/api/admin/guests?id=${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast.success("Guest deleted");
      load();
    } else {
      toast.error("Delete failed");
    }
  };

  return (
    <AdminLayout activePage="guests">
      <div className="p-4 lg:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold mb-1">Guest sessions</h1>
            <p className="text-muted-foreground">
              Every visitor gets a permanent guest session. Their enrolled batches stay saved.
            </p>
          </div>
          <Button onClick={load} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="p-5 flex items-center gap-4">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <div className="text-2xl font-bold">{total}</div>
              <div className="text-sm text-muted-foreground">Total guests</div>
            </div>
          </Card>
          <Card className="p-5 flex items-center gap-4">
            <Users className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold">{totalEnrollments}</div>
              <div className="text-sm text-muted-foreground">Total enrolled batches</div>
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <Input
            placeholder="Search by guest id or name…"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            className="max-w-md"
          />
        </Card>

        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">Guest</th>
                <th className="p-3">Batches</th>
                <th className="p-3">First seen</th>
                <th className="p-3">Last seen</th>
                <th className="p-3 text-right">Actions</th>
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
              {!loading && guests.length === 0 && (
                <tr>
                  <td className="p-4 text-muted-foreground" colSpan={5}>
                    No guest sessions yet.
                  </td>
                </tr>
              )}
              {guests.map((g) => (
                <Fragment key={g.id}>
                  <tr className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{g.label}</div>
                      <div className="text-xs text-muted-foreground break-all">{g.id}</div>
                    </td>
                    <td className="p-3">
                      <button
                        className="underline decoration-dotted"
                        onClick={() => setExpanded(expanded === g.id ? null : g.id)}
                      >
                        {g.enrolledCount} batches
                      </button>
                    </td>
                    <td className="p-3">{new Date(g.createdAt).toLocaleString()}</td>
                    <td className="p-3">{new Date(g.lastSeenAt).toLocaleString()}</td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => remove(g.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </td>
                  </tr>
                  {expanded === g.id && (
                    <tr className="bg-muted/30">
                      <td className="p-3" colSpan={5}>
                        {g.batches?.length ? (
                          <ul className="space-y-1">
                            {g.batches.map((b) => (
                              <li key={b.batchId}>
                                <span className="font-medium">{b.batchName || "(no name)"}</span>{" "}
                                <span className="text-xs text-muted-foreground">{b.batchId}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted-foreground">No batches enrolled.</span>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
