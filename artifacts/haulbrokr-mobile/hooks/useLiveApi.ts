import { useAuth } from "@clerk/expo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`;

async function apiFetch(
  getToken: () => Promise<string | null>,
  method: string,
  path: string,
  body?: object
) {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function useMyProfile() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["profile", "me"],
    queryFn: () => apiFetch(getToken, "GET", "/profiles/me"),
    enabled: !!isSignedIn,
    retry: 1,
  });
}

export function useCreateProfile() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      role: string;
      companyName: string;
      phone?: string;
      city?: string;
      state?: string;
      inviteCode?: string;
      // carrier / provider fields
      dba?: string;
      website?: string;
      mcNumber?: string;
      capacityTons?: number;
      capacityYards?: number;
      countiesServed?: string;
      hourlyRate?: number;
      minimumHours?: number;
      // customer fields
      billingEinLast4?: string;
      apContactName?: string;
      apEmail?: string;
      paymentTerms?: string;
    }) => apiFetch(getToken, "POST", "/profiles", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useProjects() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiFetch(getToken, "GET", "/projects"),
    enabled: !!isSignedIn,
  });
}

export function useCreateProject() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      siteAddress?: string;
      totalBudget?: number;
      startDate?: string;
      endDate?: string;
    }) => apiFetch(getToken, "POST", "/projects", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useFactoringRequests() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["factoring"],
    queryFn: () => apiFetch(getToken, "GET", "/factoring"),
    enabled: !!isSignedIn,
  });
}

export function useRequestFactoring() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: number }) =>
      apiFetch(getToken, "POST", "/factoring", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["factoring"] }),
  });
}

export function useQBStatus() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["quickbooks", "status"],
    queryFn: () => apiFetch(getToken, "GET", "/quickbooks/status"),
    enabled: !!isSignedIn,
  });
}

export function useQBConnect() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { companyName: string }) =>
      apiFetch(getToken, "POST", "/quickbooks/connect", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quickbooks"] }),
  });
}

export function useQBSync() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(getToken, "POST", "/quickbooks/sync"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quickbooks"] }),
  });
}

export function useQBDisconnect() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(getToken, "POST", "/quickbooks/disconnect"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quickbooks"] }),
  });
}

export function useCompliance() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["compliance"],
    queryFn: () => apiFetch(getToken, "GET", "/account/compliance"),
    enabled: !!isSignedIn,
  });
}

export function useAccountStatus() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["account", "status"],
    queryFn: () => apiFetch(getToken, "GET", "/account/status"),
    enabled: !!isSignedIn,
  });
}

export function useSubmitCompliance() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      dotNumber?: string;
      mcNumber?: string;
      cdlNumber?: string;
      cdlState?: string;
      cdlClass?: string;
      cdlExpiry?: string;
    }) => apiFetch(getToken, "POST", "/account/compliance", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance"] }),
  });
}

export function useVerifyCompliance() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(getToken, "PATCH", "/account/compliance/verify"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compliance"] }),
  });
}

// ── Credit Application (customer Net terms) ─────────────────────────────────
export function useCreditApplication() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["credit-application"],
    queryFn: () => apiFetch(getToken, "GET", "/account/credit-application"),
    enabled: !!isSignedIn,
    retry: 1,
  });
}

export function useSubmitCreditApplication() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      wantsInvoicing: boolean;
      tradeReferences?: string;
      bankReference?: string;
      estimatedMonthlySpend?: number;
    }) => apiFetch(getToken, "POST", "/account/credit-application", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["credit-application"] }),
  });
}

// ── Job payments (broker fee charge / payout release) ───────────────────────
export function useChargeJob() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => apiFetch(getToken, "POST", `/jobs/${jobId}/charge`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useReleaseJobPayment() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => apiFetch(getToken, "POST", `/jobs/${jobId}/release`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useCreateJobCheckoutSession() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: ({ jobId, returnTo }: { jobId: number; returnTo: string }) =>
      apiFetch(getToken, "POST", `/jobs/${jobId}/checkout-session`, { returnTo }) as Promise<{ url: string }>,
  });
}

export function useVerifyJobCheckout() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ jobId, sessionId }: { jobId: number; sessionId: string }) =>
      apiFetch(getToken, "POST", `/jobs/${jobId}/verify-checkout`, { sessionId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useJobEvidence(jobId: number | null) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["evidence", jobId],
    queryFn: () => apiFetch(getToken, "GET", `/jobs/${jobId}/evidence`),
    enabled: !!isSignedIn && !!jobId,
  });
}

export function useSubmitEvidence() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: number; photoUrl?: string; photoCaption?: string; siteNotes?: string }) =>
      apiFetch(getToken, "POST", `/jobs/${data.jobId}/evidence`, {
        photoUrl: data.photoUrl,
        photoCaption: data.photoCaption,
        siteNotes: data.siteNotes,
      }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ["evidence", vars.jobId] }),
  });
}

// ── Job status-update timeline (driver / foreman) ──────────────────────────
export type JobStatusUpdateStatus =
  | "en_route" | "arrived" | "loading" | "loaded" | "dumping" | "completed";

export type JobStatusUpdate = {
  id: number;
  jobId: number;
  ticketId?: number | null;
  actorProfileId: number;
  actorName?: string | null;
  status: JobStatusUpdateStatus;
  note?: string | null;
  createdAt: string;
};

export function useJobStatusUpdates(jobId: number | null, opts?: { refetchInterval?: number | false }) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<JobStatusUpdate[]>({
    queryKey: ["status-updates", jobId],
    queryFn: () => apiFetch(getToken, "GET", `/jobs/${jobId}/status-updates`),
    enabled: !!isSignedIn && !!jobId,
    refetchInterval: opts?.refetchInterval,
  });
}

export function useCreateJobStatusUpdate() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: number; status: JobStatusUpdateStatus; ticketId?: number; note?: string }) =>
      apiFetch(getToken, "POST", `/jobs/${data.jobId}/status-updates`, {
        status: data.status,
        ticketId: data.ticketId,
        note: data.note,
      }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["status-updates", vars.jobId] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

// ── Completion approval (foreman / customer) ───────────────────────────────
export function useApproveCompletion() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => apiFetch(getToken, "POST", `/jobs/${jobId}/approve-completion`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useFlagCompletion() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: number; reason: string }) =>
      apiFetch(getToken, "POST", `/jobs/${data.jobId}/flag-completion`, { reason: data.reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useLiveJobs() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["jobs"],
    queryFn: () => apiFetch(getToken, "GET", "/jobs"),
    enabled: !!isSignedIn,
  });
}

// ── Load requests (customer-posted loads) ──────────────────────────────────
export function useLiveRequests(opts?: { mine?: boolean; enabled?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  const mine = opts?.mine ?? false;
  const path = mine ? "/requests?mine=true" : "/requests";
  return useQuery({
    queryKey: ["requests", { mine }],
    queryFn: () => apiFetch(getToken, "GET", path),
    enabled: !!isSignedIn && (opts?.enabled ?? true),
  });
}

export type CreateRequestInput = {
  materialType: string;
  quantityTons: number;
  pickupAddress: string;
  deliveryAddress: string;
  scheduledDate: string;
  trucksNeeded: number;
  budgetPerHour?: number;
  notes?: string;
};

export function useCreateRequest() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRequestInput) =>
      apiFetch(getToken, "POST", "/requests", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

/** Provider places a bid on a customer's open load request. */
export function useCreateBid() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      requestId: number;
      ratePerHour: number;
      trucksOffered: number;
      estimatedHours?: number;
      message?: string;
    }) => {
      const { requestId, ...body } = data;
      return apiFetch(getToken, "POST", `/requests/${requestId}/bids`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

/** Customer edits an open load request (used here to cancel by status). */
export function useUpdateRequest() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { requestId: number; status?: string; notes?: string }) => {
      const { requestId, ...body } = data;
      return apiFetch(getToken, "PATCH", `/requests/${requestId}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

/** Customer deletes their own load request (only allowed before a job exists). */
export function useDeleteRequest() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (requestId: number) =>
      apiFetch(getToken, "DELETE", `/requests/${requestId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["requests"] });
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

/** Update a live job's status (in_progress / completed). */
export function useUpdateJob() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: number; status: "in_progress" | "completed"; totalHours?: number; notes?: string }) => {
      const { jobId, ...body } = data;
      return apiFetch(getToken, "PATCH", `/jobs/${jobId}`, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["status-updates"] });
    },
  });
}

// ── Organization (Phase 1 backend) ─────────────────────────────────────────
export function useMyOrganization() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["organization", "me"],
    queryFn: () => apiFetch(getToken, "GET", "/organizations/me"),
    enabled: !!isSignedIn,
    retry: 1,
  });
}

export function useOrgMembers() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["organization", "members"],
    queryFn: () => apiFetch(getToken, "GET", "/organizations/members"),
    enabled: !!isSignedIn,
    retry: 1,
  });
}

export function useRotateInviteCode() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(getToken, "POST", "/organizations/rotate-code"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organization"] }),
  });
}

// ── Tickets (Phase 2/3 backend) ────────────────────────────────────────────
export function useTickets(jobId: number | null) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["tickets", jobId],
    queryFn: () => apiFetch(getToken, "GET", `/jobs/${jobId}/tickets`),
    enabled: !!isSignedIn && !!jobId,
  });
}

export function useCreateTicket() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { jobId: number; weightTons?: number; notes?: string; photoUrl?: string }) =>
      apiFetch(getToken, "POST", `/jobs/${data.jobId}/tickets`, {
        weightTons: data.weightTons,
        notes: data.notes,
        photoUrl: data.photoUrl,
      }),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["tickets", vars.jobId] }),
  });
}

export function useTicketClockIn() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number) => apiFetch(getToken, "POST", `/tickets/${ticketId}/clock-in`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useTicketClockOut() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number) => apiFetch(getToken, "POST", `/tickets/${ticketId}/clock-out`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useIssueTicketQR() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ticketId: number): Promise<{ token: string; expiresAt: string; ticket: any }> =>
      apiFetch(getToken, "POST", `/tickets/${ticketId}/qr`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useVerifyTicket() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string): Promise<{ ok: boolean; ticket: any; verifierName: string }> =>
      apiFetch(getToken, "POST", `/tickets/verify`, { token }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

// ── Driver Documents ───────────────────────────────────────────────────────
export type RemoteDriverDoc = {
  id: number;
  profileId: number;
  docType: string;
  status: "missing" | "uploaded" | "verified" | "rejected";
  objectPath: string | null;
  fileName: string | null;
  mimeType: string | null;
  docNumber: string | null;
  expiry: string | null;
  uploadedAt: string | null;
  verifiedAt: string | null;
};

export function useDriverDocs() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<RemoteDriverDoc[]>({
    queryKey: ["driver-docs"],
    queryFn: () => apiFetch(getToken, "GET", "/driver-docs"),
    enabled: !!isSignedIn,
  });
}

export function useUpsertDriverDoc() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      docType: string;
      objectPath?: string;
      storageToken?: string;
      fileName?: string;
      mimeType?: string;
      docNumber?: string | null;
      expiry?: string | null;
    }) => {
      const { docType, ...body } = data;
      return apiFetch(getToken, "PUT", `/driver-docs/${docType}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-docs"] }),
  });
}

export function useDeleteDriverDoc() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (docType: string) =>
      apiFetch(getToken, "DELETE", `/driver-docs/${docType}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver-docs"] }),
  });
}

/** Upload a file: request presigned URL, PUT bytes, finalize server-side.
 * Returns objectPath and storageToken required by PUT /driver-docs/:docType. */
export function useUploadFile() {
  const { getToken } = useAuth();
  return useMutation({
    mutationFn: async (asset: { uri: string; name: string; mimeType: string }) => {
      const blob = await (await fetch(asset.uri)).blob();
      const presign = (await apiFetch(getToken, "POST", "/storage/uploads/request-url", {
        name: asset.name,
        size: blob.size,
        contentType: asset.mimeType,
      })) as { uploadURL: string; objectPath: string; uploadToken: string };
      const put = await fetch(presign.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": asset.mimeType },
        body: blob,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      const finalized = (await apiFetch(getToken, "POST", "/storage/uploads/finalize", {
        objectPath: presign.objectPath,
        uploadToken: presign.uploadToken,
      })) as { storageToken: string; objectPath: string };
      return { objectPath: finalized.objectPath, storageToken: finalized.storageToken, size: blob.size };
    },
  });
}

// ── Stripe Connect (provider payouts) ──────────────────────────────────────
export type PayoutRequirement = {
  code: string;
  label: string;
};

export type PayoutRequirements = {
  currentlyDue: PayoutRequirement[];
  pendingVerification: PayoutRequirement[];
  disabledReason: string | null;
  currentDeadline: number | null;
};

export type PayoutStatus = {
  connected: boolean;
  stripeAccountId?: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirements?: PayoutRequirements;
};

export function usePayoutStatus() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<PayoutStatus>({
    queryKey: ["payout-status"],
    queryFn: () => apiFetch(getToken, "GET", "/payouts/status"),
    enabled: !!isSignedIn,
  });
}

export function useConnectStripe() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars?: { returnTo?: string }) =>
      apiFetch(getToken, "POST", "/payouts/connect-link", vars?.returnTo ? { returnTo: vars.returnTo } : undefined) as Promise<{ url: string; stripeAccountId: string }>,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payout-status"] }),
  });
}

// ── Bin rental (catalog + customer orders) ─────────────────────────────────
export type BinCatalogItem = {
  id: string;
  serviceType: "temporary" | "permanent";
  binSize: string;
  binType: string;
  size: string;
  type: string;
  description: string;
  priceRange: string;
  priceUnit: string;
  bestFor: string;
  estimateCents: number;
};

export type LiveBinOrder = {
  id: string;
  serviceType: "temporary" | "permanent";
  binSize: string;
  binType: string;
  binSizeLabel: string;
  binTypeLabel: string;
  deliveryAddress: string;
  wasteType: string;
  status: string;
  displayStatus: string;
  estimatedCost: string;
  priceRange: string | null;
  priceUnit: string | null;
  deliveryDate: string;
  createdAt: string;
};

export function useBins(serviceType?: "temporary" | "permanent") {
  const { getToken, isSignedIn } = useAuth();
  const path = serviceType ? `/bins?serviceType=${serviceType}` : "/bins";
  return useQuery<BinCatalogItem[]>({
    queryKey: ["bins", { serviceType: serviceType ?? "all" }],
    queryFn: () => apiFetch(getToken, "GET", path),
    enabled: !!isSignedIn,
  });
}

export function useBinOrders() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<LiveBinOrder[]>({
    queryKey: ["bin-orders"],
    queryFn: () => apiFetch(getToken, "GET", "/bin-orders"),
    enabled: !!isSignedIn,
  });
}

export function useBinOrder(id?: string) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<LiveBinOrder>({
    queryKey: ["bin-order", id],
    queryFn: () => apiFetch(getToken, "GET", `/bin-orders/${id}`),
    enabled: !!isSignedIn && !!id,
  });
}

export function useCreateBinOrder() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      serviceType: "temporary" | "permanent";
      binSize: string;
      binType: string;
      deliveryAddress: string;
      deliveryDate: string;
      wasteType: string;
      quantity?: number;
      notes?: string;
    }) => apiFetch(getToken, "POST", "/bin-orders", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bin-orders"] }),
  });
}

export function useUpdateBinOrder() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      orderId: string;
      deliveryDate?: string;
      wasteType?: string;
      deliveryAddress?: string;
    }) => {
      const { orderId, ...body } = data;
      return apiFetch(getToken, "PATCH", `/bin-orders/${orderId}`, body);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["bin-orders"] });
      qc.invalidateQueries({ queryKey: ["bin-order", vars.orderId] });
    },
  });
}

export function useCancelBinOrder() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) =>
      apiFetch(getToken, "PATCH", `/bin-orders/${orderId}/cancel`),
    onSuccess: (_data, orderId) => {
      qc.invalidateQueries({ queryKey: ["bin-orders"] });
      qc.invalidateQueries({ queryKey: ["bin-order", orderId] });
    },
  });
}

export function useLiveDashboard() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => apiFetch(getToken, "GET", "/dashboard/stats"),
    enabled: !!isSignedIn,
  });
}

export function useLiveActivity() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery({
    queryKey: ["dashboard", "activity"],
    queryFn: () => apiFetch(getToken, "GET", "/dashboard/activity"),
    enabled: !!isSignedIn,
  });
}

// ── Fleet (provider-owned trucks) ──────────────────────────────────────────
export type LiveTruck = {
  id: number;
  ownerId: number;
  ownerCompany: string;
  truckType: string;
  capacityTons: number;
  ratePerHour: number;
  licensePlate?: string | null;
  year?: number | null;
  make?: string | null;
  model?: string | null;
  isAvailable: boolean;
  notes?: string | null;
  createdAt: string | Date;
};

export function useTrucks() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<LiveTruck[]>({
    queryKey: ["trucks"],
    queryFn: () => apiFetch(getToken, "GET", "/trucks"),
    enabled: !!isSignedIn,
  });
}

export type CreateTruckInput = {
  truckType: string;
  capacityTons: number;
  ratePerHour: number;
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  truckNumber?: string;
  vin?: string;
  isAvailable?: boolean;
  notes?: string;
};

export function useCreateTruck() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTruckInput) => apiFetch(getToken, "POST", "/trucks", data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trucks"] }),
  });
}

export type DumpSite = {
  id: number;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  type: string;
  phone?: string | null;
  isActive: boolean;
  fullAddress?: string;
};

/** Public dump-site directory (no auth required). */
export function useDumpSites(opts?: { state?: string }) {
  const state = opts?.state;
  const path = state ? `/dump-sites?state=${encodeURIComponent(state)}` : "/dump-sites";
  return useQuery<DumpSite[]>({
    queryKey: ["dump-sites", { state }],
    queryFn: () => apiFetch(() => Promise.resolve(null), "GET", path),
  });
}

export type PaymentMethod = {
  methodType?: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  bankName?: string | null;
  accountLast4?: string | null;
  verificationStatus?: string | null;
};

export function usePaymentMethod() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<PaymentMethod | null>({
    queryKey: ["payment-method"],
    queryFn: async () => {
      try {
        return await apiFetch(getToken, "GET", "/account/payment-method");
      } catch (err: any) {
        if (err?.message?.includes("not found") || err?.message?.includes("404")) return null;
        throw err;
      }
    },
    enabled: !!isSignedIn,
    retry: false,
  });
}

// ── Admin: stuck payouts (mirrors the web admin Payouts tab) ────────────────
export type AdminPermission =
  | "overview"
  | "payouts"
  | "credit"
  | "compliance"
  | "bins"
  | "view_staff"
  | "manage_staff";
export type AdminStaffRole = "ap" | "ar" | "cfo" | "cto" | "ceo" | "accounting" | "it";

export function useAdminAccess() {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<{ isAdmin: boolean; staffRole: AdminStaffRole | null; permissions: AdminPermission[] }>({
    queryKey: ["admin", "access"],
    queryFn: () => apiFetch(getToken, "GET", "/admin/access"),
    enabled: !!isSignedIn,
    retry: 1,
  });
}

export type StuckPayoutItem = {
  id: number;
  materialType: string;
  customerCompany: string;
  providerCompany: string;
  providerNetAmount: number | null;
  customerTotalAmount: number | null;
  paymentAttempts: number;
  payoutRetryFailures: number;
  payoutAlertSentAt: string | null;
  completedAt: string | null;
  createdAt: string | null;
};

export type RetryPayoutResult = {
  jobId: number;
  outcome: "released" | "skipped" | "failed";
  message: string;
};

export type ResetPayoutFailuresResult = {
  id: number;
  payoutRetryFailures: number;
  payoutAlertSentAt: string | null;
};

export function useStuckPayouts(opts?: { enabled?: boolean; refetchInterval?: number | false }) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<StuckPayoutItem[]>({
    queryKey: ["admin", "stuck-payouts"],
    queryFn: () => apiFetch(getToken, "GET", "/admin/stuck-payouts"),
    enabled: !!isSignedIn && (opts?.enabled ?? true),
    // Poll only while a screen passes a positive interval (gated on focus so we
    // don't keep hitting the API when the screen isn't visible).
    refetchInterval: opts?.refetchInterval ?? false,
    refetchIntervalInBackground: false,
  });
}

export function useRetryStuckPayout() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<RetryPayoutResult, Error, number>({
    mutationFn: (id: number) =>
      apiFetch(getToken, "POST", `/admin/stuck-payouts/${id}/retry`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "stuck-payouts"] }),
  });
}

/**
 * Clears a stuck payout's consecutive-failure counter and alert timestamp once
 * an admin has resolved the underlying problem. Does NOT attempt a transfer —
 * that's what useRetryStuckPayout is for.
 */
export function useResetPayoutFailures() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation<ResetPayoutFailuresResult, Error, number>({
    mutationFn: (id: number) =>
      apiFetch(getToken, "POST", `/admin/stuck-payouts/${id}/reset-failures`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "stuck-payouts"] }),
  });
}

// ── Admin: carrier compliance review (mirrors the web admin Carriers tab) ────
export type AdminProfileSummary = {
  id: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  role: string;
};

export type AdminComplianceItem = {
  id: number;
  profileId: number;
  dotNumber: string | null;
  mcNumber: string | null;
  cdlNumber: string | null;
  cdlState: string | null;
  cdlClass: string | null;
  cdlExpiry: string | null;
  fmcsaAuthority: string | null;
  insuranceActive: string | null;
  dotOperatingStatus: string | null;
  notSuspended: string | null;
  safetyRating: string | null;
  status: string;
  reviewNote: string | null;
  submittedAt: string | null;
  profile: AdminProfileSummary;
};

export function useAdminCompliance(opts?: { enabled?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<AdminComplianceItem[]>({
    queryKey: ["admin", "compliance"],
    queryFn: () => apiFetch(getToken, "GET", "/admin/compliance"),
    enabled: !!isSignedIn && (opts?.enabled ?? true),
  });
}

export function useReviewCompliance() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { profileId: number; action: "approve" | "reject"; note?: string }) => {
      const { profileId, ...body } = data;
      return apiFetch(getToken, "PATCH", `/admin/compliance/${profileId}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "compliance"] }),
  });
}

// ── Admin: customer credit-application review (mirrors web Credit tab) ────────
export type AdminCreditApplicationItem = {
  id: number;
  profileId: number;
  wantsInvoicing: boolean;
  tradeReferences: string | null;
  bankReference: string | null;
  estimatedMonthlySpend: number | null;
  status: string;
  reviewNote: string | null;
  createdAt: string | null;
  profile: AdminProfileSummary;
};

export function useAdminCreditApplications(opts?: { enabled?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<AdminCreditApplicationItem[]>({
    queryKey: ["admin", "credit-applications"],
    queryFn: () => apiFetch(getToken, "GET", "/admin/credit-applications"),
    enabled: !!isSignedIn && (opts?.enabled ?? true),
  });
}

export function useReviewCreditApplication() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { profileId: number; action: "approve" | "reject"; note?: string }) => {
      const { profileId, ...body } = data;
      return apiFetch(getToken, "PATCH", `/admin/credit-applications/${profileId}`, body);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "credit-applications"] }),
  });
}

// ── Wallet: real provider balance + transactions (GET /api/wallet) ───────────
export type WalletTransaction = {
  id: string;
  type: "payout" | "factoring" | "earning";
  description: string;
  amount: number;
  status: string;
  createdAt: string;
};

export type Wallet = {
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  payoutAccount: { connected: boolean; payoutsEnabled: boolean; bankLast4: string | null };
  transactions: WalletTransaction[];
};

export function useWallet(opts?: { enabled?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<Wallet>({
    queryKey: ["wallet"],
    queryFn: () => apiFetch(getToken, "GET", "/wallet"),
    enabled: !!isSignedIn && (opts?.enabled ?? true),
  });
}

// ── Job chat messages (GET/POST /api/jobs/:id/messages) ──────────────────────
export type JobMessage = {
  id: number;
  jobId: number;
  senderProfileId: number;
  senderName: string;
  body: string;
  createdAt: string;
};

export function useJobMessages(jobId: number | null, opts?: { enabled?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<JobMessage[]>({
    queryKey: ["job", jobId, "messages"],
    queryFn: () => apiFetch(getToken, "GET", `/jobs/${jobId}/messages`),
    enabled: !!isSignedIn && jobId != null && (opts?.enabled ?? true),
    refetchInterval: 8000,
  });
}

export function useSendJobMessage(jobId: number | null) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiFetch(getToken, "POST", `/jobs/${jobId}/messages`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", jobId, "messages"] }),
  });
}

// ── Job ratings (GET/POST /api/jobs/:id/rating) ──────────────────────────────
export type JobRating = {
  id: number;
  jobId: number;
  raterProfileId: number;
  rateeProfileId: number;
  stars: number;
  comment: string | null;
  createdAt: string;
};

export function useJobRating(jobId: number | null, opts?: { enabled?: boolean }) {
  const { getToken, isSignedIn } = useAuth();
  return useQuery<{ mine: JobRating | null; theirs: JobRating | null }>({
    queryKey: ["job", jobId, "rating"],
    queryFn: () => apiFetch(getToken, "GET", `/jobs/${jobId}/rating`),
    enabled: !!isSignedIn && jobId != null && (opts?.enabled ?? true),
  });
}

export function useSubmitJobRating(jobId: number | null) {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { stars: number; comment?: string }) =>
      apiFetch(getToken, "POST", `/jobs/${jobId}/rating`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", jobId, "rating"] }),
  });
}
