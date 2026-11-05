"use client";

import { ClientPage } from "@/components/client-page";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { medicines } from "@/db/schema";
import { requirePharmacist } from "@/lib/auth/session";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { AddMedicineForm } from "@/components/pharmacy/medicine-forms";

async function __render() {
  await requirePharmacist();
  const cats = await db.selectDistinct({ category: medicines.category }).from(medicines).orderBy(asc(medicines.category));
  return (
    <div className="max-w-4xl">
      <PageHeader
        back={{ href: "/pharmacy/inventory", label: "Inventory" }}
        title="Add a medicine"
        description="Creates a new SKU in the hospital formulary. A SKU code (MED-xxxx) is assigned automatically."
      />
      <Card>
        <CardBody className="sm:p-6">
          <AddMedicineForm categories={cats.map((c) => c.category)} />
        </CardBody>
      </Card>
    </div>
  );
}

const __loader = () => __render();

export default function PageView() {
  return <ClientPage render={__loader} props={{}} />;
}
