import { Router, type IRouter } from "express";
import { eq, and, or, sql, isNull } from "drizzle-orm";
import crypto from "node:crypto";
import {
  db,
  profilesTable,
  ticketsTable,
  type Profile,
  type Ticket,
  type Job,
} from "@workspace/db";
import { requireProfile, getRequestProfile } from "../middlewares/requireAuth";
import { loadJobIfMember, DRIVER_SIDE, CUSTOMER_SIDE } from "../lib/access";
import { recordJobTimelineEvent } from "../lib/jobTimeline";

const router: IRouter = Router();

// ── HMAC token helpers ─────────────────────────────────────────────────────
// Tokens are signed by the server and verified by the server. Format:
//   <base64url(payload-json)>.<base64url(hmac-sha256(secret, payload-json))>
// Payload: { j: jobId, t: ticketId, n: nonce, e: expEpochMs }

const TICKET_QR_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getSecret(): string {
  const s = process.env.TICKET_QR_SECRET;
  if (s && s.length >= 32) return s;
  // Dev-mode fallback: derive from DATABASE_URL so tokens survive restarts
  // in a single environment but differ across deployments. NEVER ship to prod
  // without setting TICKET_QR_SECRET — the API logs a warning at first use.
  const seed = process.env.DATABASE_URL ?? "haulbrokr-dev-fallback";
  return crypto
    .createHash("sha256")
    .update(`db-ticket-qr:${seed}`)
    .digest("hex");
}

function b64url(buf: Buffer | string): string {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return b
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}
function signPayload(payload: object): string {
  const json = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", getSecret()).update(json).digest();
  return `${b64url(json)}.${b64url(sig)}`;
}
interface TicketTokenPayload {
  j: number;
  t: number;
  n: string;
  e: number;
}

function isTicketTokenPayload(value: unknown): value is TicketTokenPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.j === "number" &&
    typeof p.t === "number" &&
    typeof p.n === "string" &&
    typeof p.e === "number"
  );
}

function verifyToken(
  token: string,
):
  | { ok: true; j: number; t: number; n: string; e: number }
  | { ok: false; error: string } {
  const parts = token.trim().split(".");
  if (parts.length !== 2) return { ok: false, error: "Malformed token" };
  let payloadJson: string;
  try {
    payloadJson = b64urlDecode(parts[0]).toString("utf8");
  } catch {
    return { ok: false, error: "Malformed token" };
  }
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(payloadJson)
    .digest();
  const actualSig = b64urlDecode(parts[1]);
  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    return { ok: false, error: "Invalid signature" };
  }
  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: "Malformed payload" };
  }
  if (!isTicketTokenPayload(payload)) {
    return { ok: false, error: "Malformed payload fields" };
  }
  if (Date.now() > payload.e)
    return {
      ok: false,
      error: "Token expired — driver should refresh the QR.",
    };
  return { ok: true, j: payload.j, t: payload.t, n: payload.n, e: payload.e };
}

// ── Routes ────────────────────────────────────────────────────────────────

router.get(
  "/jobs/:id/tickets",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    const jobId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    const tickets = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.jobId, jobId))
      .orderBy(sql`${ticketsTable.loadNumber} asc`);
    res.json({ tickets });
  },
);

router.post(
  "/jobs/:id/tickets",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (!DRIVER_SIDE.has(profile.role)) {
      res
        .status(403)
        .json({ error: "Only drivers and providers can create tickets." });
      return;
    }
    const jobId = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(jobId)) {
      res.status(400).json({ error: "Invalid job id" });
      return;
    }
    const job = await loadJobIfMember(jobId, profile);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    // Drivers may only create additional load tickets on jobs to which they have
    // already been explicitly assigned (i.e. the provider has run /jobs/:id/assign
    // for them, which creates an initial ticket with their driverProfileId).
    // Provider/owner accounts retain unrestricted ticket-creation on their jobs.
    if (profile.role === "driver") {
      const [assigned] = await db
        .select({ id: ticketsTable.id })
        .from(ticketsTable)
        .where(
          and(
            eq(ticketsTable.jobId, jobId),
            eq(ticketsTable.driverProfileId, profile.id),
          ),
        );
      if (!assigned) {
        res.status(403).json({ error: "You are not assigned to this job." });
        return;
      }
    }

    // Auto-increment load number
    const existing = await db
      .select({ ln: ticketsTable.loadNumber })
      .from(ticketsTable)
      .where(eq(ticketsTable.jobId, jobId));
    const nextLoad = existing.reduce((m, r) => Math.max(m, r.ln), 0) + 1;

    const body = req.body ?? {};
    const weight =
      body.weightTons !== undefined && body.weightTons !== null
        ? String(body.weightTons)
        : null;
    const [ticket] = await db
      .insert(ticketsTable)
      .values({
        jobId,
        driverProfileId: profile.id,
        loadNumber: nextLoad,
        status: "pending",
        weightTons: weight,
        notes: body.notes ?? null,
        photoUrl: body.photoUrl ?? null,
      })
      .returning();
    await recordJobTimelineEvent(jobId, profile.id, "ticket_uploaded", {
      ticketId: ticket.id,
      note: body.photoUrl
        ? `Load #${nextLoad} ticket with photo`
        : `Load #${nextLoad} ticket logged`,
    });
    res.status(201).json(ticket);
  },
);

async function loadOwnedTicket(
  ticketId: number,
  profile: Profile,
): Promise<{ ticket: Ticket; job: Job } | null> {
  const [ticket] = await db
    .select()
    .from(ticketsTable)
    .where(eq(ticketsTable.id, ticketId));
  if (!ticket) return null;
  const job = await loadJobIfMember(ticket.jobId, profile);
  if (!job) return null;
  // Drivers may only mutate tickets that are assigned to themselves.
  // Provider org-owners and managers retain full access.
  if (profile.role === "driver" && ticket.driverProfileId !== profile.id)
    return null;
  return { ticket, job };
}

router.post(
  "/tickets/:id/clock-in",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (!DRIVER_SIDE.has(profile.role)) {
      res
        .status(403)
        .json({ error: "Only drivers and providers can clock in." });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    const found = await loadOwnedTicket(id, profile);
    if (!found) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (found.ticket.clockedInAt) {
      res.status(409).json({ error: "Already clocked in." });
      return;
    }
    const [updated] = await db
      .update(ticketsTable)
      .set({ clockedInAt: new Date(), status: "in_progress" })
      .where(eq(ticketsTable.id, id))
      .returning();
    await recordJobTimelineEvent(found.ticket.jobId, profile.id, "checked_in", {
      ticketId: id,
      note: `Checked in for load #${found.ticket.loadNumber}`,
    });
    res.json(updated);
  },
);

router.post(
  "/tickets/:id/clock-out",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (!DRIVER_SIDE.has(profile.role)) {
      res
        .status(403)
        .json({ error: "Only drivers and providers can clock out." });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    const found = await loadOwnedTicket(id, profile);
    if (!found) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (!found.ticket.clockedInAt) {
      res.status(409).json({ error: "Clock in first." });
      return;
    }
    if (found.ticket.clockedOutAt) {
      res.status(409).json({ error: "Already clocked out." });
      return;
    }
    const [updated] = await db
      .update(ticketsTable)
      .set({ clockedOutAt: new Date(), status: "completed" })
      .where(eq(ticketsTable.id, id))
      .returning();
    res.json(updated);
  },
);

router.post(
  "/tickets/:id/qr",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (!DRIVER_SIDE.has(profile.role)) {
      res.status(403).json({
        error: "Only drivers and providers can issue ticket QR codes.",
      });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (!Number.isFinite(id)) {
      res.status(400).json({ error: "Invalid ticket id" });
      return;
    }
    const found = await loadOwnedTicket(id, profile);
    if (!found) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    if (found.ticket.verifiedAt) {
      res
        .status(409)
        .json({ error: "Ticket already verified — no new QR can be issued." });
      return;
    }

    const nonce = crypto.randomBytes(12).toString("hex");
    const exp = Date.now() + TICKET_QR_TTL_MS;
    const token = signPayload({
      j: found.ticket.jobId,
      t: found.ticket.id,
      n: nonce,
      e: exp,
    });
    const [updated] = await db
      .update(ticketsTable)
      .set({
        qrNonce: nonce,
        qrIssuedAt: new Date(),
        qrExpiresAt: new Date(exp),
      })
      .where(eq(ticketsTable.id, id))
      .returning();
    res.json({ token, expiresAt: updated.qrExpiresAt, ticket: updated });
  },
);

router.post(
  "/tickets/verify",
  requireProfile,
  async (req, res): Promise<void> => {
    const profile = getRequestProfile(req);
    if (!CUSTOMER_SIDE.has(profile.role)) {
      res
        .status(403)
        .json({ error: "Only customers and supervisors can verify tickets." });
      return;
    }
    const token = String(req.body?.token ?? "");
    if (!token) {
      res.status(400).json({ error: "Missing token." });
      return;
    }
    const v = verifyToken(token);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    // Authorization: verifier must be a member of the job's customer side.
    const job = await loadJobIfMember(v.j, profile);
    if (!job) {
      res.status(403).json({ error: "You don't have access to this job." });
      return;
    }
    if (
      !CUSTOMER_SIDE.has(profile.role) ||
      (profile.role === "supervisor" &&
        job.customerId !== profile.id &&
        (
          await db
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.id, job.customerId))
        )[0]?.organizationId !== profile.organizationId)
    ) {
      res
        .status(403)
        .json({ error: "You aren't on the customer side of this job." });
      return;
    }
    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.id, v.t));
    if (!ticket || ticket.jobId !== v.j) {
      res.status(404).json({ error: "Ticket not found." });
      return;
    }

    // Atomic single-use verify: the UPDATE must match an unverified ticket whose
    // current nonce equals the token nonce. On success we null the nonce so the
    // same token cannot be replayed even within its TTL.
    const [updated] = await db
      .update(ticketsTable)
      .set({
        status: "verified",
        verifiedAt: new Date(),
        verifiedByProfileId: profile.id,
        qrNonce: null,
        qrExpiresAt: null,
      })
      .where(
        and(
          eq(ticketsTable.id, v.t),
          eq(ticketsTable.qrNonce, v.n),
          isNull(ticketsTable.verifiedAt),
        ),
      )
      .returning();
    if (!updated) {
      if (ticket.verifiedAt) {
        res.status(409).json({
          error: `Ticket #${ticket.loadNumber} was already verified at ${ticket.verifiedAt.toISOString()}.`,
        });
      } else {
        res
          .status(409)
          .json({ error: "QR code is stale — ask the driver to refresh it." });
      }
      return;
    }
    res.json({
      ok: true,
      ticket: updated,
      verifierName: profile.contactName ?? profile.companyName,
    });
  },
);

export default router;
