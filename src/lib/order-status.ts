// Shared by server and client code (no secrets, no DB).
export const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment", paid: "Paid", processing: "Preparing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
};

/** Statuses that count as a purchase (revenue, "spent", reorder reminders). */
export const PAID_STATUSES = ["paid", "processing", "shipped", "delivered"] as const;

/** The only status moves the admin may make. Enforced on the server; mirrored in the UI. */
export const TRANSITIONS: Record<string, string[]> = {
  pending: ["cancelled"],
  paid: ["processing", "shipped", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};
