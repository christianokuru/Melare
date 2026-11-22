import type { Metadata } from "next";
import { Suspense } from "react";
import { getShippingZones } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { InfoPage } from "@/components/site/info-page";

export const metadata: Metadata = { title: "Shipping & Delivery", description: "Delivery times and fees for Lagos, across Nigeria and international orders from Melaré.", alternates: { canonical: "/shipping" } };

export default function ShippingPage() {
  return (
    <InfoPage title="Shipping & delivery" intro="Orders are packed within 24 hours on business days (Monday–Friday, excluding public holidays).">
      <Suspense fallback={null}><Zones /></Suspense>
      <h2>Tracking</h2>
      <p>You’ll receive an email with your tracking number as soon as your order ships. You can also check its status any time on the Track order page.</p>
      <h2>International orders</h2>
      <p>Customs duties and import taxes, where applicable, are set by your country and are the responsibility of the recipient.</p>
    </InfoPage>
  );
}

async function Zones() {
  const zones = await getShippingZones();
  return (
    <div className="overflow-x-auto rounded-2xl border">
      <table className="w-full text-left text-sm">
        <thead className="bg-blush"><tr><th className="p-3 font-medium">Destination</th><th className="p-3 font-medium">Delivery time</th><th className="p-3 font-medium">Fee</th><th className="p-3 font-medium">Free over</th></tr></thead>
        <tbody>
          {zones.map((z) => (
            <tr key={z.id} className="border-t">
              <td className="p-3">{z.name}</td><td className="p-3">{z.eta}</td>
              <td className="p-3">{formatMoney(z.feeNgn, "NGN")} / {formatMoney(z.feeUsd, "USD")}</td>
              <td className="p-3">{z.freeOverNgn != null ? `${formatMoney(z.freeOverNgn, "NGN")} / ${formatMoney(z.freeOverUsd ?? 0, "USD")}` : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
