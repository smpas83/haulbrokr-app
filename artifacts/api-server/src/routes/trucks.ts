import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, trucksTable, profilesTable } from "@workspace/db";
import { getRequestProfile, requireProfile } from "../middlewares/requireAuth";
import {
  ListTrucksQueryParams,
  ListTrucksResponse,
  CreateTruckBody,
  GetTruckParams,
  GetTruckResponse,
  UpdateTruckParams,
  UpdateTruckBody,
  UpdateTruckResponse,
  DeleteTruckParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/trucks", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const params = ListTrucksQueryParams.safeParse(req.query);

  let trucks;
  if (profile.role === "provider") {
    trucks = await db
      .select()
      .from(trucksTable)
      .where(eq(trucksTable.ownerId, profile.id));
  } else {
    const conditions = [eq(trucksTable.isAvailable, true)];
    trucks = await db.select().from(trucksTable).where(and(...conditions));
  }

  const enriched = trucks.map((t) => ({
    ...t,
    capacityTons: parseFloat(t.capacityTons),
    ratePerHour: parseFloat(t.ratePerHour),
    ownerCompany: "",
  }));

  res.json(ListTrucksResponse.parse(enriched));
});

router.post("/trucks", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  if (profile.role !== "provider") {
    res.status(403).json({ error: "Only providers can add trucks" });
    return;
  }
  const parsed = CreateTruckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [truck] = await db.insert(trucksTable).values({
    ...parsed.data,
    ownerId: profile.id,
    capacityTons: String(parsed.data.capacityTons),
    ratePerHour: String(parsed.data.ratePerHour),
  }).returning();
  res.status(201).json({
    ...truck,
    capacityTons: parseFloat(truck.capacityTons),
    ratePerHour: parseFloat(truck.ratePerHour),
    ownerCompany: profile.companyName,
  });
});

router.get("/trucks/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetTruckParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [truck] = await db.select().from(trucksTable).where(eq(trucksTable.id, params.data.id));
  if (!truck) {
    res.status(404).json({ error: "Truck not found" });
    return;
  }
  if (truck.ownerId !== profile.id && !truck.isAvailable && !profile.staffRole) {
    res.status(404).json({ error: "Truck not found" });
    return;
  }
  res.json(GetTruckResponse.parse({
    ...truck,
    capacityTons: parseFloat(truck.capacityTons),
    ratePerHour: parseFloat(truck.ratePerHour),
    ownerCompany: "",
  }));
});

router.patch("/trucks/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateTruckParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateTruckBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [truck] = await db
    .update(trucksTable)
    .set({
      ...parsed.data,
      capacityTons: parsed.data.capacityTons != null ? String(parsed.data.capacityTons) : undefined,
      ratePerHour: parsed.data.ratePerHour != null ? String(parsed.data.ratePerHour) : undefined,
    })
    .where(and(eq(trucksTable.id, params.data.id), eq(trucksTable.ownerId, profile.id)))
    .returning();
  if (!truck) {
    res.status(404).json({ error: "Truck not found" });
    return;
  }
  res.json(UpdateTruckResponse.parse({
    ...truck,
    capacityTons: parseFloat(truck.capacityTons),
    ratePerHour: parseFloat(truck.ratePerHour),
    ownerCompany: profile.companyName,
  }));
});

router.delete("/trucks/:id", requireProfile, async (req, res): Promise<void> => {
  const profile = getRequestProfile(req);
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteTruckParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [truck] = await db
    .delete(trucksTable)
    .where(and(eq(trucksTable.id, params.data.id), eq(trucksTable.ownerId, profile.id)))
    .returning();
  if (!truck) {
    res.status(404).json({ error: "Truck not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
