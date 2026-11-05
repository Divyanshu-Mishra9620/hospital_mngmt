import { ActionForm } from "@/components/admin/action-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/form";
import { DescriptionList, PageHeader } from "@/components/ui/misc";
import { adminSaveSettings } from "@/lib/actions/admin";
import { requireAdmin } from "@/lib/auth/session";
import { HOSPITAL } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requireAdmin();
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" description="Hospital-wide defaults for fees, the pharmacy and online booking." />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ActionForm action={adminSaveSettings} submitLabel="Save settings" pendingText="Saving…" footerClassName="justify-end">
          <Card>
            <CardHeader title="Consultation fees" description="Defaults for newly added doctors. Each doctor's own fee can be changed on their profile." />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Default in-person (OPD) fee (₹)" htmlFor="defaultInPersonFee">
                <Input id="defaultInPersonFee" name="defaultInPersonFee" type="number" min={0} step={10} defaultValue={s.defaultInPersonFee} />
              </Field>
              <Field label="Default video consultation fee (₹)" htmlFor="defaultVideoFee">
                <Input id="defaultVideoFee" name="defaultVideoFee" type="number" min={0} step={10} defaultValue={s.defaultVideoFee} />
              </Field>
              <Field label="Online booking window (days)" htmlFor="bookingWindowDays" hint="How far ahead patients can book (1–90).">
                <Input id="bookingWindowDays" name="bookingWindowDays" type="number" min={1} max={90} defaultValue={s.bookingWindowDays} />
              </Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Pharmacy" description="Applied to online orders from the patient portal." />
            <CardBody className="grid gap-4 sm:grid-cols-3">
              <Field label="Delivery fee (₹)" htmlFor="deliveryFee">
                <Input id="deliveryFee" name="deliveryFee" type="number" min={0} defaultValue={s.deliveryFee} />
              </Field>
              <Field label="Free delivery above (₹)" htmlFor="freeDeliveryAbove">
                <Input id="freeDeliveryAbove" name="freeDeliveryAbove" type="number" min={0} defaultValue={s.freeDeliveryAbove} />
              </Field>
              <Field label="Discount on medicines (%)" htmlFor="pharmacyDiscountPercent">
                <Input id="pharmacyDiscountPercent" name="pharmacyDiscountPercent" type="number" min={0} max={50} defaultValue={s.pharmacyDiscountPercent} />
              </Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Website announcement" description="Shown as a banner on the public website. Leave empty to hide it." />
            <CardBody>
              <Field label="Announcement text" htmlFor="announcement" hint="Up to 280 characters.">
                <Textarea id="announcement" name="announcement" rows={2} maxLength={280} defaultValue={s.announcement} />
              </Field>
            </CardBody>
          </Card>
        </ActionForm>

        <Card className="h-fit">
          <CardHeader title="Hospital information" description="Printed on prescriptions, receipts and the website footer." />
          <CardBody>
            <DescriptionList
              cols={1}
              items={[
                { label: "Name", value: HOSPITAL.name },
                { label: "Address", value: HOSPITAL.addressLines.join(", ") },
                { label: "Main line", value: HOSPITAL.phone },
                { label: "Emergency", value: HOSPITAL.emergency },
                { label: "Ambulance", value: HOSPITAL.ambulance },
                { label: "Email", value: HOSPITAL.email },
                { label: "GSTIN", value: HOSPITAL.gstin },
                { label: "Pharmacy licence", value: HOSPITAL.pharmacyLicence },
              ]}
            />
            <p className="mt-4 text-xs text-ink-500">These details are configured in the application (src/lib/constants.ts) by the IT team.</p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
