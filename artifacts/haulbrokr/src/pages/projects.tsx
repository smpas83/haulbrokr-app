import { useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FolderOpen, DollarSign, Calendar, Layers, Loader2, Trash2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useGetMyProfile } from "@workspace/api-client-react";
import { PageHeader } from "@/components/design";
import { apiFetch } from "@/lib/apiFetch";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  on_hold: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
};

function BudgetBar({ spent, total }: { spent: number; total: number | null }) {
  if (!total) return <p className="text-sm text-muted-foreground">No budget set</p>;
  const pct = Math.min((spent / total) * 100, 100);
  const color = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-muted-foreground">${spent.toLocaleString()} spent</span>
        <span className="text-muted-foreground">${total.toLocaleString()} budget</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground text-right">{(100 - pct).toFixed(0)}% remaining</p>
    </div>
  );
}

function NewProjectDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", siteAddress: "", totalBudget: "", startDate: "", endDate: "", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => apiFetch("/projects", { method: "POST", body: JSON.stringify({ ...form, totalBudget: form.totalBudget ? parseFloat(form.totalBudget) : undefined }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: "Project created" });
      setOpen(false);
      setForm({ name: "", description: "", siteAddress: "", totalBudget: "", startDate: "", endDate: "", notes: "" });
      onCreated();
    },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="font-bold rounded-xl"><Plus className="mr-2 h-4 w-4" />New Project</Button>
      </DialogTrigger>
      <DialogContent className="rounded-xl border-2 max-w-lg">
        <DialogHeader><DialogTitle>Create New Project</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div><Label>Project Name *</Label><Input className="rounded-xl mt-1" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Downtown Office Build-Out" /></div>
          <div><Label>Site Address</Label><Input className="rounded-xl mt-1" value={form.siteAddress} onChange={e => setForm(f => ({ ...f, siteAddress: e.target.value }))} placeholder="123 Main St, Houston TX" /></div>
          <div><Label>Description</Label><Input className="rounded-xl mt-1" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." /></div>
          <div><Label>Total Budget ($)</Label><Input className="rounded-xl mt-1" type="number" value={form.totalBudget} onChange={e => setForm(f => ({ ...f, totalBudget: e.target.value }))} placeholder="50000" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Start Date</Label><Input className="rounded-xl mt-1" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
            <div><Label>End Date</Label><Input className="rounded-xl mt-1" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          </div>
          <Button className="w-full rounded-xl font-bold" disabled={!form.name || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Create Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProjectsPage() {
  const { data: profile } = useGetMyProfile();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch("/projects"),
    enabled: profile?.role === "customer",
  });

  const deleteProject = useMutation({
    mutationFn: (id: number) => apiFetch(`/projects/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); toast({ title: "Project deleted" }); },
    onError: (e: any) => toast({ title: e.message, variant: "destructive" }),
  });

  if (profile?.role !== "customer") {
    return (
      <div className="text-center py-20">
        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Projects are for customers</h2>
        <p className="text-muted-foreground mt-2">Switch to a customer account to manage projects.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 page-enter">
      <PageHeader
        eyebrow="Projects"
        title="Projects"
        description="Group your hauling requests and track budgets per project."
        actions={<NewProjectDialog onCreated={() => {}} />}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-border/60 p-16 text-center">
          <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-bold text-lg">No projects yet</h3>
          <p className="text-muted-foreground mb-6">Create a project to group your haul requests and track spend</p>
          <NewProjectDialog onCreated={() => {}} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p: any) => (
            <div key={p.id} className="bg-card border border-border/60 hover:border-primary/40 transition-colors group">
              <div className="bg-secondary text-secondary-foreground p-4 flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`rounded-xl border text-xs font-bold uppercase ${STATUS_COLORS[p.status]}`}>{p.status.replace("_"," ")}</Badge>
                  </div>
                  <h3 className="font-bold text-lg leading-tight truncate">{p.name}</h3>
                  {p.siteAddress && <p className="text-xs text-secondary-foreground/60 mt-1 truncate">{p.siteAddress}</p>}
                </div>
                <button onClick={() => deleteProject.mutate(p.id)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-1 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {p.description && <p className="text-sm text-muted-foreground line-clamp-2">{p.description}</p>}

                <BudgetBar spent={p.spentAmount} total={p.totalBudget} />

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  {p.startDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(p.startDate), "MMM d")}
                      {p.endDate ? ` – ${format(new Date(p.endDate), "MMM d, yyyy")}` : ""}
                    </span>
                  )}
                </div>

                <Link href={`/projects/${p.id}`}>
                  <Button variant="outline" className="w-full rounded-xl border-2 font-bold text-xs uppercase tracking-wider mt-2 group-hover:border-primary/40">
                    <Layers className="mr-2 h-3 w-3" /> View Project
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {projects.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card border border-border/60 p-4 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Active Projects</p>
            <p className="text-3xl font-black">{projects.filter((p: any) => p.status === "active").length}</p>
          </div>
          <div className="bg-card border border-border/60 p-4 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Budget</p>
            <p className="text-3xl font-black">${projects.reduce((s: number, p: any) => s + (p.totalBudget || 0), 0).toLocaleString()}</p>
          </div>
          <div className="bg-card border border-border/60 p-4 text-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Total Spent</p>
            <p className="text-3xl font-black">${projects.reduce((s: number, p: any) => s + (p.spentAmount || 0), 0).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
