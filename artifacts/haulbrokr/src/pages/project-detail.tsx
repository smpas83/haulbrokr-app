import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MapPin, Calendar, DollarSign, Truck, CheckCircle2, Clock, AlertCircle, TrendingUp, Layers, HardHat, UserPlus, X } from "lucide-react";
import {
  useListProjectAssignments, getListProjectAssignmentsQueryKey,
  useCreateProjectAssignment, useRemoveProjectAssignment,
  useListOrgMembers,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

function ForemanAssignments({ projectId }: { projectId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data: assignments, isLoading } = useListProjectAssignments(projectId);
  const { data: membersResp } = useListOrgMembers();
  const supervisors = (membersResp?.members ?? []).filter(m => m.role === "supervisor");

  const invalidate = () => qc.invalidateQueries({ queryKey: getListProjectAssignmentsQueryKey(projectId) });

  const create = useCreateProjectAssignment({
    mutation: {
      onSuccess: () => { invalidate(); setSelected(""); toast({ title: "Foreman assigned to site" }); },
      onError: (e: any) => toast({ title: "Failed to assign foreman", description: e.message, variant: "destructive" }),
    },
  });

  const remove = useRemoveProjectAssignment({
    mutation: {
      onSuccess: () => { invalidate(); toast({ title: "Foreman removed from site" }); },
      onError: (e: any) => toast({ title: "Failed to remove foreman", description: e.message, variant: "destructive" }),
    },
  });

  const assigned = assignments ?? [];
  const assignedIds = new Set(assigned.map(a => a.supervisorProfileId));
  const available = supervisors.filter(s => !assignedIds.has(s.id));

  const handleAssign = () => {
    if (!selected) return;
    create.mutate({ id: projectId, data: { supervisorProfileId: Number(selected) } });
  };

  return (
    <div className="bg-muted/30 p-6 border-2 border-border space-y-4">
      <div className="flex items-center gap-2">
        <HardHat className="h-5 w-5 text-primary" />
        <h3 className="font-bold uppercase tracking-wider text-sm">Site Foremen</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Assign foremen (supervisors) to oversee this job site. They can track loads and approve completed jobs on your behalf.
      </p>

      {isLoading ? (
        <Skeleton className="h-12 w-full rounded-none" />
      ) : assigned.length > 0 ? (
        <div className="space-y-2">
          {assigned.map(a => (
            <div key={a.id} className="flex items-center justify-between bg-card p-3 border-2 border-border">
              <div className="flex items-center gap-3">
                <HardHat className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold text-sm">{a.supervisorName || `Foreman #${a.supervisorProfileId}`}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="rounded-none h-8 w-8 text-destructive hover:bg-destructive/10"
                disabled={remove.isPending}
                onClick={() => remove.mutate({ id: projectId, profileId: a.supervisorProfileId })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground italic">No foremen assigned yet.</p>
      )}

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Select value={selected} onValueChange={setSelected} disabled={available.length === 0}>
          <SelectTrigger className="rounded-none border-2 flex-1">
            <SelectValue placeholder={available.length === 0 ? "No available foremen" : "Select a foreman..."} />
          </SelectTrigger>
          <SelectContent className="rounded-none border-2">
            {available.map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.contactName || s.companyName || `Foreman #${s.id}`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button className="rounded-none font-bold" onClick={handleAssign} disabled={!selected || create.isPending}>
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-2" /> Assign</>}
        </Button>
      </div>
      {supervisors.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          No foremen in your company yet. Invite them from the Company page.
        </p>
      )}
    </div>
  );
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Request failed"); }
  return res.json();
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200",
  on_hold: "bg-amber-100 text-amber-800 border-amber-200",
  completed: "bg-gray-100 text-gray-800 border-gray-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

function BudgetProgress({ spent, total }: { spent: number; total: number | null }) {
  if (!total) return null;
  const pct = Math.min((spent / total) * 100, 100);
  const remaining = total - spent;
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="bg-muted/30 p-6 border-2 border-border space-y-4">
      <h3 className="font-bold uppercase tracking-wider text-sm">Budget Tracker</h3>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Budget</p><p className="text-2xl font-black">${total.toLocaleString()}</p></div>
        <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spent</p><p className="text-2xl font-black text-primary">${spent.toLocaleString()}</p></div>
        <div><p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</p><p className={`text-2xl font-black ${remaining < 0 ? "text-red-500" : "text-green-600"}`}>${remaining.toLocaleString()}</p></div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1 font-medium">
          <span>{pct.toFixed(1)}% used</span><span>{(100 - pct).toFixed(1)}% left</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden"><div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} /></div>
      </div>
      {pct > 90 && <p className="text-sm font-bold text-red-600 flex items-center gap-2"><AlertCircle className="h-4 w-4" />Budget nearly exhausted</p>}
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: () => apiFetch(`/projects/${id}`),
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: (data: any) => apiFetch(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project updated" });
      setEditing(false);
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="max-w-5xl mx-auto space-y-6"><Skeleton className="h-10 w-48" /><Skeleton className="h-64 w-full" /></div>;
  if (!project) return <div className="text-center py-20"><h2 className="text-2xl font-bold">Project not found</h2><Button className="mt-4" onClick={() => setLocation("/projects")}>Back</Button></div>;

  const startEditing = () => {
    setEditForm({
      name: project.name,
      description: project.description || "",
      siteAddress: project.siteAddress || "",
      totalBudget: project.totalBudget || "",
      status: project.status,
      notes: project.notes || "",
    });
    setEditing(true);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-12">
      <Button variant="ghost" className="-ml-4" onClick={() => setLocation("/projects")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Projects
      </Button>

      <div className="bg-card border-2 border-border overflow-hidden">
        <div className="bg-secondary text-secondary-foreground p-6 md:p-8 flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            {editing ? (
              <Input className="rounded-none text-2xl font-bold bg-white/10 border-white/20 text-white placeholder:text-white/50 mb-2" value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} />
            ) : (
              <h1 className="text-3xl font-black tracking-tight">{project.name}</h1>
            )}
            {project.siteAddress && <p className="flex items-center gap-2 text-secondary-foreground/70 mt-1"><MapPin className="h-4 w-4" />{project.siteAddress}</p>}
          </div>
          <div className="flex items-center gap-3">
            {editing ? (
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger className="rounded-none bg-white/10 border-white/20 text-white w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["active","on_hold","completed","cancelled"].map(s => <SelectItem key={s} value={s}>{s.replace("_"," ")}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Badge className={`rounded-none border-2 font-bold uppercase text-xs px-3 py-1 ${STATUS_COLORS[project.status]}`}>{project.status.replace("_"," ")}</Badge>
            )}
            {editing ? (
              <div className="flex gap-2">
                <Button size="sm" className="rounded-none" disabled={update.isPending} onClick={() => update.mutate(editForm)}>
                  {update.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="rounded-none text-white hover:bg-white/10" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="rounded-none text-white hover:bg-white/10" onClick={startEditing}>Edit</Button>
            )}
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <BudgetProgress spent={project.spentAmount} total={project.totalBudget} />

          <ForemanAssignments projectId={id} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/30 p-4 border-2 border-border text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Requests</p>
              <p className="text-2xl font-black">{project.requests?.length ?? 0}</p>
            </div>
            <div className="bg-muted/30 p-4 border-2 border-border text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Total Jobs</p>
              <p className="text-2xl font-black">{project.jobCount ?? 0}</p>
            </div>
            <div className="bg-muted/30 p-4 border-2 border-border text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Completed Jobs</p>
              <p className="text-2xl font-black text-green-600">{project.completedJobs ?? 0}</p>
            </div>
            <div className="bg-muted/30 p-4 border-2 border-border text-center">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Budget Used</p>
              <p className="text-2xl font-black">{project.totalBudget ? `${((project.spentAmount / project.totalBudget) * 100).toFixed(0)}%` : "—"}</p>
            </div>
          </div>

          {project.description && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
              <p className="text-sm text-muted-foreground">{project.description}</p>
            </div>
          )}

          {project.requests?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Linked Haul Requests ({project.requests.length})</p>
              <div className="space-y-2">
                {project.requests.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between bg-muted/30 p-3 border border-border">
                    <div className="flex items-center gap-3">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm capitalize">{r.materialType} — {r.quantityTons} tons</span>
                    </div>
                    <Badge variant="outline" className="rounded-none text-xs">{r.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
