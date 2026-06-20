import { pgTable, text, uuid, integer, timestamp, boolean } from "drizzle-orm/pg-core";

export const binOrders = pgTable("bin_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: text("customer_id").notNull(),
  customerCompany: text("customer_company"),

  serviceType: text("service_type").notNull(), // 'temporary' | 'permanent'
  binSize: text("bin_size").notNull(), // '2_yard' | '4_yard' | '6_yard' | '8_yard' | '10_yard' | '20_yard' | '30_yard' | '40_yard'
  binType: text("bin_type").notNull(), // 'roll_off' | 'front_load' | 'rear_load'
  quantity: integer("quantity").notNull().default(1),

  deliveryAddress: text("delivery_address").notNull(),
  deliveryLat: text("delivery_lat"),
  deliveryLng: text("delivery_lng"),

  deliveryDate: timestamp("delivery_date").notNull(),
  pickupDate: timestamp("pickup_date"),

  wasteType: text("waste_type").notNull(), // 'general' | 'construction' | 'yard' | 'recycling' | 'hazardous'
  preferredProvider: text("preferred_provider"), // 'waste_management' | 'republic' | 'key_disposal' | 'clean_earth' | 'any'

  status: text("status").notNull().default("pending"), // 'pending' | 'confirmed' | 'delivered' | 'picked_up' | 'cancelled'
  estimatedCostCents: integer("estimated_cost_cents"),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
