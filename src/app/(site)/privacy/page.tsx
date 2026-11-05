import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <>
      <PageHero title="Privacy policy" description="How we collect, use and protect your personal and health information." crumbs={[{ href: "/privacy", label: "Privacy" }]} />
      <section className="container-page py-12 sm:py-16">
        <div className="prose-medora max-w-3xl">
          <p>
            {HOSPITAL.name} (“Medora”, “we”) respects your privacy. This policy explains what information we collect through our website, patient app and hospital services, and how we keep it safe. It is
            written to align with India&apos;s Digital Personal Data Protection Act, 2023.
          </p>
          <h2>Information we collect</h2>
          <ul>
            <li>Identity and contact details — name, date of birth, gender, phone, email, address.</li>
            <li>Health information — appointments, prescriptions, vitals, diagnoses, care plans and reports created during your care.</li>
            <li>Payment information — transaction references and amounts. We never store full card numbers.</li>
            <li>Technical data — device and usage information needed to keep the service secure.</li>
          </ul>
          <h2>How we use it</h2>
          <ul>
            <li>To provide and coordinate your medical care, including video consultations.</li>
            <li>To process appointments, pharmacy orders, payments and insurance claims.</li>
            <li>To send you service notifications such as appointment reminders and order updates.</li>
            <li>To meet legal and regulatory obligations for medical records.</li>
          </ul>
          <h2>Who can see your records</h2>
          <p>Your records are visible only to clinicians and staff involved in your care, on a need-to-know basis, and every access is logged. We do not sell your data.</p>
          <h2>Your rights</h2>
          <p>You may access, correct or request a copy of your information, and withdraw consent for non-essential processing, by writing to {HOSPITAL.email}.</p>
          <h2>Security</h2>
          <p>Data is encrypted in transit, passwords are hashed, and access is role-based and audited.</p>
          <h2>Contact</h2>
          <p>
            Grievance Officer, {HOSPITAL.name}, {HOSPITAL.addressLines.join(", ")} · {HOSPITAL.email}
          </p>
        </div>
      </section>
    </>
  );
}
