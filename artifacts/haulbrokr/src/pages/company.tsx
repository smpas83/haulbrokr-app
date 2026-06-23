import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Users, Loader2, Copy, RefreshCw, ShieldCheck,
  UserMinus, Crown, HardHat, Truck, Check
} from "lucide-react";
import {
  useGetMyProfile,
  useListOrgMembers, getListOrgMembersQueryKey,
  useUpdateOrgMemberRole, useRemoveOrgMember,
  UpdateMemberRoleInputOrgRole,
  type OrgMember,
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

async function rawFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Request failed"); }
  if (res.status === 204) return null;
  return res.json();
}

function roleBadge(member: OrgMember) {
  if (member.orgRole === "owner") {
    return <Badge className="rounded-none bg-primary text-primary-foreground font-bold uppercase text-[10px]"><Crown className="h-3 w-3 mr-1" /> Owner</Badge>;
  }
  if (member.orgRole === "admin") {
    return <Badge className="rounded-none bg-secondary text-secondary-foreground font-bold uppercase text-[10px]"><ShieldCheck className="h-3 w-3 mr-1" /> Admin</Badge>;
  }
  return <Badge variant="secondary" className="rounded-none font-bold uppercase text-[10px] text-muted-foreground">Member</Badge>;
}

function workerBadge(role: string) {
  if (role === "driver") return <Badge variant="outline" className="rounded-none text-[10px] uppercase"><Truck className="h-3 w-3 mr-1" /> Driver</Badge>;
  if (role === "supervisor") return <Badge variant="outline" className="rounded-none text-[10px] uppercase"><HardHat className="h-3 w-3 mr-1" /> Foreman</Badge>;
  return <Badge variant="outline" className="rounded-none text-[10px] uppercase capitalize">{role}</Badge>;
}

function InviteCodePanel({ canManage }: { canManage: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  const { data: org, isLoading } = useQuery({
    queryKey: ["organization", "me"],
    queryFn: () => rawFetch("/api/organizations/me"),
  });

  const handleCopy = () => {
    if (!org?.inviteCode) return;
    navigator.clipboard?.writeText(org.inviteCode);
    setCopied(true);
    toast({ title: "Invite code copied" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRotate = async () => {
    setRotating(true);
    try {
      await rawFetch("/api/organizations/rotate-code", { method: "POST" });
      await qc.invalidateQueries({ queryKey: ["organization", "me"] });
      toast({ title: "Invite code rotated", description: "The old code no longer works." });
    } catch (e: any) {
      toast({ title: "Failed to rotate code", description: e.message, variant: "destructive" });
    } finally {
      setRotating(false);
    }
  };

  if (isLoading) return <Skeleton className="h-40 w-full rounded-none" />;
  if (!org) return null;

  return (
    <div className="bg-card border-2 border-border p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold tracking-tight">{org.name || "Your Company"}</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Share this code with employees so they can join your company. Drivers join the fleet; foremen supervise job sites.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="flex-1 bg-muted/40 border-2 border-border px-4 py-3 font-mono text-2xl font-black tracking-[0.3em] text-center select-all">
          {org.inviteCode || "——————"}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-none border-2 font-bold" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy
          </Button>
          {canManage && (
            <Button variant="outline" className="rounded-none border-2 font-bold" onClick={handleRotate} disabled={rotating}>
              {rotating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Rotate
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ComplianceStatusPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["organization", "compliance-status"],
    queryFn: () => rawFetch("/api/organizations/compliance-status"),
  });

  if (isLoading) return <Skeleton className="h-40 w-full rounded-none" />;
  if (!data) return null;

  const badge = (status: string) => {
    if (status === "verified") return <Badge className="rounded-none bg-green-500 hover:bg-green-600">Verified</Badge>;
    if (status === "pending") return <Badge className="rounded-none bg-amber-500 text-amber-950">Pending</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="rounded-none">Rejected</Badge>;
    return <Badge variant="secondary" className="rounded-none">Not submitted</Badge>;
  };

  return (
    <div className="bg-card border-2 border-border">
      <div className="p-5 border-b-2 border-border">
        <h2 className="font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" /> Carrier Compliance
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Document verification status for your hauling company.</p>
      </div>
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between p-3 border border-border">
          <span className="font-medium">W-9</span>
          {badge(data.w9Status)}
        </div>
        <div className="flex items-center justify-between p-3 border border-border">
          <span className="font-medium">Insurance / COI</span>
          {badge(data.insuranceStatus)}
        </div>
        <div className="flex items-center justify-between p-3 border border-border">
          <span className="font-medium">DOT / CDL</span>
          {badge(data.dotCdlStatus)}
        </div>
        {data.canBid ? (
          <p className="text-sm text-green-700 font-medium">Company is eligible to bid on jobs.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Complete and pass compliance review before bidding.</p>
        )}
        {data.w9ReviewNote && data.w9Status === "rejected" && (
          <p className="text-sm text-destructive">W-9: {data.w9ReviewNote}</p>
        )}
        {data.insuranceReviewNote && data.insuranceStatus === "rejected" && (
          <p className="text-sm text-destructive">Insurance: {data.insuranceReviewNote}</p>
        )}
        {data.dotCdlReviewNote && data.dotCdlStatus === "rejected" && (
          <p className="text-sm text-destructive">DOT/CDL: {data.dotCdlReviewNote}</p>
        )}
      </div>
    </div>
  );
}

export default function CompanyPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useGetMyProfile();
  const { data: membersResp, isLoading: membersLoading } = useListOrgMembers();

  const isOwner = profile?.role === "customer" || profile?.role === "provider";

  const updateRole = useUpdateOrgMemberRole({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListOrgMembersQueryKey() }); toast({ title: "Member role updated" }); },
      onError: (e: any) => toast({ title: "Failed to update role", description: e.message, variant: "destructive" }),
    },
  });

  const removeMember = useRemoveOrgMember({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListOrgMembersQueryKey() }); toast({ title: "Member removed from company" }); },
      onError: (e: any) => toast({ title: "Failed to remove member", description: e.message, variant: "destructive" }),
    },
  });

  if (profileLoading) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const isProviderSide = profile?.role === "provider" || profile?.role === "driver";

  if (!profile?.organizationId) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Company</h2>
        <p className="text-muted-foreground mt-2">Join a company with an invite code to see team and compliance information.</p>
      </div>
    );
  }

  if (profile.role === "driver") {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" /> Company
          </h1>
          <p className="text-muted-foreground mt-1">Your hauling company compliance status.</p>
        </div>
        <ComplianceStatusPanel />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-bold">Company administration</h2>
        <p className="text-muted-foreground mt-2">Only the company owner or an admin can manage members.</p>
      </div>
    );
  }

  const members = membersResp?.members ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
          <Building2 className="h-8 w-8 text-primary" /> Company
        </h1>
        <p className="text-muted-foreground mt-1">Manage your team, roles, and invite code.</p>
      </div>

      {isProviderSide && <ComplianceStatusPanel />}

      <InviteCodePanel canManage={isOwner} />

      <div className="bg-card border-2 border-border">
        <div className="p-5 border-b-2 border-border flex items-center justify-between">
          <h2 className="font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" /> Team Members
          </h2>
          <Badge variant="outline" className="rounded-none font-bold">{members.length}</Badge>
        </div>

        {membersLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-none" />)}
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground">No team members yet. Share your invite code to add drivers and foremen.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => {
              const isSelf = m.id === profile.id;
              const isOrgOwner = m.orgRole === "owner";
              const canEdit = isOwner && !isSelf && !isOrgOwner;
              return (
                <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold truncate">{m.contactName || m.companyName}</span>
                      {roleBadge(m)}
                      {workerBadge(m.role)}
                      {isSelf && <span className="text-[10px] uppercase tracking-wider text-muted-foreground">(You)</span>}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {m.email || "—"}{m.phone ? ` · ${m.phone}` : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Select
                        value={m.orgRole === "admin" ? "admin" : "member"}
                        onValueChange={(v) => updateRole.mutate({ id: m.id, data: { orgRole: v as any } })}
                        disabled={updateRole.isPending}
                      >
                        <SelectTrigger className="rounded-none border-2 w-32 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-none border-2">
                          <SelectItem value={UpdateMemberRoleInputOrgRole.admin}>Admin</SelectItem>
                          <SelectItem value={UpdateMemberRoleInputOrgRole.member}>Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs text-muted-foreground w-32 text-center hidden sm:block">
                        {isOrgOwner ? "Owner" : isSelf ? "—" : ""}
                      </span>
                    )}

                    {canEdit && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" className="rounded-none border-2 text-destructive hover:bg-destructive/10 hover:border-destructive h-9 w-9">
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-none border-2">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {m.contactName || m.companyName}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              They will lose access to your company's jobs and fleet. They can rejoin later with an invite code.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-none border-2">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-none bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => removeMember.mutate({ id: m.id })}
                            >
                              Remove Member
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
