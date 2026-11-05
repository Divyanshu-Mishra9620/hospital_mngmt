import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ExternalLink, KeyRound, UserRound } from "lucide-react";
import { changeDoctorPassword, updateDoctorProfile } from "@/lib/actions/doctor";
import { requireDoctor } from "@/lib/auth/session";
import { doctorWithDepartment } from "@/lib/doctor/queries";
import { fmtDateTime, inr } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, DescriptionList, PageHeader } from "@/components/ui/misc";
import { DoctorProfileForm, PasswordForm } from "@/components/doctor/profile-forms";

export const metadata: Metadata = { title: "Profile" };

export default async function DoctorProfilePage() {
  const { user, doctor } = await requireDoctor();
  const info = await doctorWithDepartment(doctor.id);

  return (
    <>
      <PageHeader title="Profile & password" description="Keep your public profile current. Fees and department are managed by the administrator." />
      <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card>
            <CardBody>
              <div className="flex items-center gap-4">
                <Avatar name={user.name} color={doctor.avatarColor} size="xl" />
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold text-ink-900">{user.name}</p>
                  <p className="text-sm text-ink-500">{doctor.designation}</p>
                </div>
              </div>
              <DescriptionList
                cols={1}
                className="mt-5"
                items={[
                  { label: "Doctor ID", value: doctor.code },
                  { label: "Department", value: info?.departmentName },
                  { label: "Qualifications", value: doctor.qualifications },
                  { label: "Registration no.", value: doctor.registrationNo },
                  { label: "Experience", value: `${doctor.experienceYears} years` },
                  { label: "Consultation room", value: doctor.room },
                  { label: "Email", value: user.email },
                  { label: "Last sign-in", value: fmtDateTime(user.lastLoginAt) },
                ]}
              />
              <Link href={`/doctors/${doctor.code}`} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                View public profile <ExternalLink className="size-3.5" />
              </Link>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Consultation fees" icon={<BadgeCheck />} description="Set by the hospital" />
            <CardBody className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-surface px-4 py-3">
                <p className="text-xs text-ink-500">In-person OPD</p>
                <p className="tabular font-display text-xl font-bold text-ink-900">{inr(doctor.inPersonFee)}</p>
              </div>
              <div className="rounded-xl bg-violet-50 px-4 py-3">
                <p className="text-xs text-violet-700">Video consult</p>
                <p className="tabular font-display text-xl font-bold text-ink-900">{doctor.videoEnabled ? inr(doctor.videoFee) : "Off"}</p>
              </div>
              <p className="col-span-2 text-xs text-ink-500">Slot length: {doctor.slotMinutes} minutes. Change it from OPD schedule.</p>
            </CardBody>
          </Card>
        </aside>
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader title="Public profile" icon={<UserRound />} />
            <CardBody>
              <DoctorProfileForm action={updateDoctorProfile} initial={{ bio: doctor.bio, expertise: doctor.expertise, languages: doctor.languages, phone: user.phone ?? "" }} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Change password" icon={<KeyRound />} />
            <CardBody className="max-w-lg">
              <PasswordForm action={changeDoctorPassword} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
