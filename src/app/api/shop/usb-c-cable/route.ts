import { withX402 } from "@x402/next";
import { orderHandler } from "@/lib/shop";
import { paidRoute, resourceServer } from "@/lib/x402-server";

export const GET = withX402(orderHandler("usb-c-cable"), paidRoute("usb-c-cable"), resourceServer);
