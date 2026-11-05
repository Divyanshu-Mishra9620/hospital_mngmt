import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

type DoctorDefaults = {
  name?: string;
  email?: string;
  phone?: string | null;
  departmentId?: number;
  designation?: string;
  qualifications?: string;
  experienceYears?: number;
  languages?: string;
  expertise?: string;
  bio?: string;
  room?: string | null;
  registrationNo?: string | null;
  inPersonFee?: number;
  videoFee?: number;
  slotMinutes?: number;
  videoEnabled?: boolean;
  avatarColor?: string;
};

/** Doctor profile + fee fields shared by the create and edit forms. */
export function DoctorFields({ d = {}, departments }: { d?: DoctorDefaults; departments: { id: number; name: string }[] }) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-700">Identity & contact</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" hint="“Dr.” is added automatically" required>
            <Input id="name" name="name" defaultValue={d.name} required />
          </Field>
          <Field label="Department" htmlFor="departmentId" required>
            <Select id="departmentId" name="departmentId" defaultValue={d.departmentId ? String(d.departmentId) : ""} required>
              <option value="" disabled>
                Select department
              </option>
              {departments.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Email (sign-in)" htmlFor="email" required>
            <Input id="email" name="email" type="email" defaultValue={d.email} required />
          </Field>
          <Field label="Mobile" htmlFor="phone">
            <Input id="phone" name="phone" type="tel" defaultValue={d.phone ?? ""} />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-700">Professional profile</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Designation" htmlFor="designation" required>
            <Input id="designation" name="designation" defaultValue={d.designation} placeholder="Consultant — Cardiology" required />
          </Field>
          <Field label="Qualifications" htmlFor="qualifications" required>
            <Input id="qualifications" name="qualifications" defaultValue={d.qualifications} placeholder="MBBS, MD, DM" required />
          </Field>
          <Field label="Experience (years)" htmlFor="experienceYears" required>
            <Input id="experienceYears" name="experienceYears" type="number" min={0} max={60} defaultValue={d.experienceYears ?? 5} required />
          </Field>
          <Field label="Languages" htmlFor="languages" required>
            <Input id="languages" name="languages" defaultValue={d.languages ?? "English, Hindi"} required />
          </Field>
          <Field label="Room" htmlFor="room">
            <Input id="room" name="room" defaultValue={d.room ?? ""} placeholder="A-204" />
          </Field>
          <Field label="Medical council reg. no." htmlFor="registrationNo">
            <Input id="registrationNo" name="registrationNo" defaultValue={d.registrationNo ?? ""} placeholder="KMC-12345" />
          </Field>
        </div>
        <Field label="Areas of expertise" htmlFor="expertise" hint="Comma-separated — shown on the public profile">
          <Input id="expertise" name="expertise" defaultValue={d.expertise} />
        </Field>
        <Field label="Short bio" htmlFor="bio">
          <Textarea id="bio" name="bio" rows={3} defaultValue={d.bio} />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-brand-700">Fees & consultation</legend>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="In-person fee (₹)" htmlFor="inPersonFee" required>
            <Input id="inPersonFee" name="inPersonFee" type="number" min={0} step={10} defaultValue={d.inPersonFee ?? 500} required />
          </Field>
          <Field label="Video consult fee (₹)" htmlFor="videoFee" required>
            <Input id="videoFee" name="videoFee" type="number" min={0} step={10} defaultValue={d.videoFee ?? 350} required />
          </Field>
          <Field label="Slot length" htmlFor="slotMinutes" required>
            <Select id="slotMinutes" name="slotMinutes" defaultValue={String(d.slotMinutes ?? 15)}>
              {[10, 15, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Avatar colour" htmlFor="avatarColor">
            <Input id="avatarColor" name="avatarColor" type="color" defaultValue={d.avatarColor ?? "#136b7a"} className="h-11 p-1.5" />
          </Field>
        </div>
        <Checkbox name="videoEnabled" defaultChecked={d.videoEnabled ?? true} label="Offer video consultations (patients can book video slots and pay the video fee)" />
      </fieldset>
    </div>
  );
}
