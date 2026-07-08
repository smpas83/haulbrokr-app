import { eq } from "drizzle-orm";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  db,
  jobsTable,
  profilesTable,
  requestsTable,
  type Job,
  type Profile,
} from "@workspace/db";
import { CUSTOMER_SIDE, DRIVER_SIDE } from "./access";

export type JobInvoiceData = {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentStatus: string;
  customerName: string;
  haulingCompanyName: string;
  customer: {
    companyName: string;
    contactName: string | null;
    addressLine: string | null;
  };
  hauler: {
    companyName: string;
    contactName: string | null;
  };
  job: {
    id: number;
    materialType: string;
    truckType: string;
    quantityTons: string | null;
    quantityLabel: string;
    pickupAddress: string;
    deliveryAddress: string;
    scheduledDate: string;
    trucksAssigned: number;
    totalHours: number | null;
    ratePerHour: number;
  };
  platformFeeRate: number;
  platformFeeAmount: number;
  providerNetAmount: number;
  customerTotalAmount: number;
  workAmount: number;
};

/** Completed jobs and net-terms invoiced jobs may download a PDF invoice. */
export function jobIsInvoiceEligible(
  job: Pick<Job, "status" | "paymentStatus">,
): boolean {
  return job.status === "completed" || job.paymentStatus === "invoiced";
}

export function formatPaymentStatusLabel(status: Job["paymentStatus"]): string {
  const labels: Record<Job["paymentStatus"], string> = {
    unpaid: "Unpaid",
    invoiced: "Invoiced",
    paid: "Paid",
    released: "Released",
    failed: "Failed",
    requires_action: "Requires action",
    partially_refunded: "Partially refunded",
    refunded: "Refunded",
  };
  return labels[status] ?? status;
}

export function formatInvoiceNumber(
  jobId: number,
  referenceDate: Date,
): string {
  return `INV-${referenceDate.getFullYear()}-${String(jobId).padStart(4, "0")}`;
}

export function formatTruckTypeLabel(truckType: string): string {
  return truckType
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMaterialLabel(materialType: string): string {
  return materialType.charAt(0).toUpperCase() + materialType.slice(1);
}

function formatUsd(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(d);
}

function computeInvoiceAmounts(job: Job) {
  if (
    job.customerTotalAmount != null &&
    job.providerNetAmount != null &&
    job.platformFeeAmount != null
  ) {
    return {
      workAmount:
        job.totalAmount != null
          ? parseFloat(job.totalAmount)
          : parseFloat(job.providerNetAmount),
      platformFeeAmount: parseFloat(job.platformFeeAmount),
      providerNetAmount: parseFloat(job.providerNetAmount),
      customerTotalAmount: parseFloat(job.customerTotalAmount),
      platformFeeRate: parseFloat(job.platformFeeRate),
    };
  }

  const hours = parseFloat(job.totalHours ?? job.estimatedHours);
  const rate = parseFloat(job.ratePerHour);
  const feeRate = parseFloat(job.platformFeeRate);
  const workAmount = Math.round(rate * hours * 100) / 100;
  const platformFeeAmount = Math.round(workAmount * feeRate * 100) / 100;
  const customerTotalAmount =
    Math.round((workAmount + platformFeeAmount) * 100) / 100;
  return {
    workAmount,
    platformFeeAmount,
    providerNetAmount: workAmount,
    customerTotalAmount,
    platformFeeRate: feeRate,
  };
}

function resolveDueDate(job: Job): Date {
  if (job.paymentDueDate) return job.paymentDueDate;
  if (job.invoicedAt) return job.invoicedAt;
  if (job.completedAt) return job.completedAt;
  return new Date();
}

function resolveIssueDate(job: Job): Date {
  return job.invoicedAt ?? job.completedAt ?? new Date();
}

function formatAddress(profile: Profile | undefined): string | null {
  if (!profile) return null;
  const parts = [
    profile.address,
    profile.city,
    profile.state,
    profile.zip,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export async function canDownloadJobInvoice(
  job: Job,
  profile: Profile,
): Promise<boolean> {
  if (profile.staffRole) return true;
  if (job.customerId === profile.id) return true;
  if (job.providerId === profile.id) return true;

  if (profile.organizationId && CUSTOMER_SIDE.has(profile.role)) {
    const [customer] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, job.customerId));
    if (customer?.organizationId === profile.organizationId) return true;
  }

  if (profile.organizationId && DRIVER_SIDE.has(profile.role)) {
    const [provider] = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.id, job.providerId));
    if (provider?.organizationId === profile.organizationId) return true;
  }

  return false;
}

export async function loadJobInvoiceData(
  jobId: number,
): Promise<JobInvoiceData | null> {
  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, jobId));
  if (!job) return null;

  const [customer] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, job.customerId));
  const [provider] = await db
    .select()
    .from(profilesTable)
    .where(eq(profilesTable.id, job.providerId));
  const [request] = await db
    .select()
    .from(requestsTable)
    .where(eq(requestsTable.id, job.requestId));

  const issueDate = resolveIssueDate(job);
  const amounts = computeInvoiceAmounts(job);
  const tons =
    request?.quantityTons != null ? parseFloat(request.quantityTons) : null;
  const hours = job.totalHours != null ? parseFloat(job.totalHours) : null;
  const quantityParts: string[] = [];
  if (tons != null && Number.isFinite(tons))
    quantityParts.push(`${tons.toLocaleString("en-US")} tons`);
  if (hours != null && Number.isFinite(hours)) {
    quantityParts.push(`${hours.toLocaleString("en-US")} hours`);
  }
  if (job.trucksAssigned > 1)
    quantityParts.push(`${job.trucksAssigned} trucks`);

  return {
    invoiceNumber: formatInvoiceNumber(job.id, issueDate),
    invoiceDate: formatDate(issueDate),
    dueDate: formatDate(resolveDueDate(job)),
    paymentStatus: formatPaymentStatusLabel(job.paymentStatus),
    customerName: customer?.companyName ?? "Customer",
    haulingCompanyName: provider?.companyName ?? "Provider",
    customer: {
      companyName: customer?.companyName ?? "Customer",
      contactName: customer?.contactName ?? null,
      addressLine: formatAddress(customer),
    },
    hauler: {
      companyName: provider?.companyName ?? "Provider",
      contactName: provider?.contactName ?? null,
    },
    job: {
      id: job.id,
      materialType: formatMaterialLabel(job.materialType),
      truckType: formatTruckTypeLabel(job.truckType),
      quantityTons:
        tons != null && Number.isFinite(tons)
          ? `${tons.toLocaleString("en-US")} tons`
          : null,
      quantityLabel: quantityParts.length
        ? quantityParts.join(" · ")
        : `${job.trucksAssigned} truck(s)`,
      pickupAddress: job.pickupAddress,
      deliveryAddress: job.deliveryAddress,
      scheduledDate: formatDate(job.scheduledDate),
      trucksAssigned: job.trucksAssigned,
      totalHours: hours,
      ratePerHour: parseFloat(job.ratePerHour),
    },
    platformFeeRate: amounts.platformFeeRate,
    platformFeeAmount: amounts.platformFeeAmount,
    providerNetAmount: amounts.providerNetAmount,
    customerTotalAmount: amounts.customerTotalAmount,
    workAmount: amounts.workAmount,
  };
}

function drawLine(
  page: ReturnType<PDFDocument["addPage"]>,
  y: number,
  margin: number,
  width: number,
  thickness = 0.5,
) {
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness,
    color: rgb(0.85, 0.85, 0.85),
  });
}

function drawLabelValue(
  page: ReturnType<PDFDocument["addPage"]>,
  label: string,
  value: string,
  x: number,
  y: number,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  bold: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  labelSize = 9,
  valueSize = 11,
) {
  page.drawText(label, {
    x,
    y,
    size: labelSize,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
  page.drawText(value, {
    x,
    y: y - 14,
    size: valueSize,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
}

export async function generateJobInvoicePdf(
  data: JobInvoiceData,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const margin = 48;
  const width = page.getWidth();
  let y = page.getHeight() - margin;

  page.drawText("HaulBrokr", {
    x: margin,
    y,
    size: 22,
    font: bold,
    color: rgb(0.91, 0.65, 0),
  });
  page.drawText("INVOICE", {
    x: width - margin - bold.widthOfTextAtSize("INVOICE", 18),
    y,
    size: 18,
    font: bold,
    color: rgb(0.1, 0.1, 0.1),
  });
  y -= 28;
  page.drawText("Professional Hauling Network", {
    x: margin,
    y,
    size: 10,
    font,
    color: rgb(0.45, 0.45, 0.45),
  });
  y -= 32;
  drawLine(page, y, margin, width);
  y -= 24;

  drawLabelValue(
    page,
    "INVOICE NUMBER",
    data.invoiceNumber,
    margin,
    y,
    font,
    bold,
  );
  drawLabelValue(
    page,
    "INVOICE DATE",
    data.invoiceDate,
    margin + 180,
    y,
    font,
    bold,
  );
  drawLabelValue(
    page,
    "DUE DATE",
    data.dueDate,
    width - margin - 140,
    y,
    font,
    bold,
  );
  y -= 48;
  drawLine(page, y, margin, width);
  y -= 28;

  page.drawText("CUSTOMER", {
    x: margin,
    y,
    size: 9,
    font: bold,
    color: rgb(0.45, 0.45, 0.45),
  });
  page.drawText("HAULING COMPANY", {
    x: width / 2 + 8,
    y,
    size: 9,
    font: bold,
    color: rgb(0.45, 0.45, 0.45),
  });
  y -= 16;
  page.drawText(data.customer.companyName, {
    x: margin,
    y,
    size: 12,
    font: bold,
  });
  page.drawText(data.hauler.companyName, {
    x: width / 2 + 8,
    y,
    size: 12,
    font: bold,
  });
  y -= 14;
  if (data.customer.contactName) {
    page.drawText(data.customer.contactName, { x: margin, y, size: 10, font });
  }
  if (data.hauler.contactName) {
    page.drawText(data.hauler.contactName, {
      x: width / 2 + 8,
      y,
      size: 10,
      font,
    });
  }
  y -= 14;
  if (data.customer.addressLine) {
    page.drawText(data.customer.addressLine, {
      x: margin,
      y,
      size: 10,
      font,
      maxWidth: width / 2 - margin - 12,
    });
  }
  y -= 32;
  drawLine(page, y, margin, width);
  y -= 24;

  page.drawText("JOB DETAILS", {
    x: margin,
    y,
    size: 10,
    font: bold,
    color: rgb(0.45, 0.45, 0.45),
  });
  y -= 20;

  const detailRows: Array<[string, string]> = [
    ["Job ID", String(data.job.id)],
    ["Material type", data.job.materialType],
    ["Truck type", data.job.truckType],
    ["Quantity / tons", data.job.quantityTons ?? data.job.quantityLabel],
    ["Pickup address", data.job.pickupAddress],
    ["Delivery address", data.job.deliveryAddress],
    ["Payment status", data.paymentStatus],
  ];
  for (const [label, value] of detailRows) {
    page.drawText(label, {
      x: margin,
      y,
      size: 10,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
    page.drawText(value, {
      x: margin + 110,
      y,
      size: 10,
      font: bold,
      maxWidth: width - margin - 110,
    });
    y -= 18;
  }

  y -= 8;
  drawLine(page, y, margin, width);
  y -= 24;

  page.drawText("SUMMARY", {
    x: margin,
    y,
    size: 10,
    font: bold,
    color: rgb(0.45, 0.45, 0.45),
  });
  y -= 22;

  const feePct = `${Math.round(data.platformFeeRate * 1000) / 10}%`;
  const summaryRows: Array<[string, string]> = [
    [`Platform fee (${feePct})`, formatUsd(data.platformFeeAmount)],
    ["Provider net amount", formatUsd(data.providerNetAmount)],
    ["Customer total amount", formatUsd(data.customerTotalAmount)],
  ];
  for (const [label, value] of summaryRows) {
    page.drawText(label, { x: margin, y, size: 10, font });
    const valueWidth = bold.widthOfTextAtSize(value, 11);
    page.drawText(value, {
      x: width - margin - valueWidth,
      y,
      size: 11,
      font: bold,
    });
    y -= 18;
  }

  y -= 8;
  drawLine(page, y, margin, width, 1);
  y -= 28;
  page.drawText("Amount due", { x: margin, y, size: 12, font: bold });
  const dueText = formatUsd(data.customerTotalAmount);
  page.drawText(dueText, {
    x: width - margin - bold.widthOfTextAtSize(dueText, 16),
    y: y - 2,
    size: 16,
    font: bold,
    color: rgb(0.91, 0.65, 0),
  });

  y -= 40;
  page.drawText(
    "Thank you for hauling with HaulBrokr. Questions? billing@haulbrokr.com",
    { x: margin, y, size: 9, font, color: rgb(0.45, 0.45, 0.45) },
  );

  return pdf.save();
}

export async function buildJobInvoicePdf(
  jobId: number,
): Promise<{ pdf: Uint8Array; invoiceNumber: string } | null> {
  const data = await loadJobInvoiceData(jobId);
  if (!data) return null;
  const pdf = await generateJobInvoicePdf(data);
  return { pdf, invoiceNumber: data.invoiceNumber };
}
