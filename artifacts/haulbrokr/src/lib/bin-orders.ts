export const BIN_ORDER_STATUS_STYLE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  picked_up: "bg-gray-100 text-gray-700 border-gray-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

export const BIN_ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending Confirmation",
  confirmed: "Confirmed",
  delivered: "Delivered",
  picked_up: "Picked Up",
  cancelled: "Cancelled",
};

export function getBinOrderStatusLabel(status: string) {
  return BIN_ORDER_STATUS_LABEL[status] ?? status;
}

export function getBinOrderStatusStyle(status: string) {
  return BIN_ORDER_STATUS_STYLE[status] ?? "";
}
