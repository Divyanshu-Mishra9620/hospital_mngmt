import { ActionForm } from "@/components/admin/action-form";
import { DoctorFields } from "@/components/admin/doctor-fields";
import { ScheduleEditor } from "@/components/admin/schedule-editor";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { adminCreateDoctor } from "@/lib/actions/admin";
import { listDepartmentsBasic } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Add doctor" };

export default async function NewDoctorPage() {
  await requireAdmin();
  const [depts, settings] = await Promise.all([listDepartmentsBasic(), getSettings()]);
  return (
    <>
      <PageHeader
        back={{ href: "/admin/doctors", label: "Doctors" }}
        title="Add a doctor"
        description="Creates the doctor's sign-in (DOC- ID with a temporary password), public profile, fees and weekly OPD timings."
      />
      <ActionForm action={adminCreateDoctor} submitLabel="Create doctor" pendingText="Creating…" className="max-w-5xl scroll-mt-20" footerClassName="justify-end" scrollOnResult>
        <Card>
          <CardHeader title="Profile & fees" description={`Default fees come from Settings: ₹${settings.defaultInPersonFee} in-person, ₹${settings.defaultVideoFee} video.`} />
          <CardBody>
            <DoctorFields departments={depts} d={{ inPersonFee: Number(settings.defaultInPersonFee), videoFee: Number(settings.defaultVideoFee) }} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Weekly OPD schedule" description="Patients can only book inside these blocks. Video-only blocks are offered as video consultations." />
          <CardBody>
            <ScheduleEditor
              initial={[1, 2, 3, 4, 5, 6].map((wd) => ({ weekday: wd, startTime: "09:30", endTime: "13:30", mode: "both" as const }))}
            />
          </CardBody>
        </Card>
      </ActionForm>
    </>
  );
}
