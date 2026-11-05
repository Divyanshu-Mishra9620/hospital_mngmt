import type { Metadata } from "next";
import { PageHero } from "@/components/site/page-hero";
import { HOSPITAL } from "@/lib/constants";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <>
      <PageHero title="Terms of use" description="Please read these terms before using our website and patient app." crumbs={[{ href: "/terms", label: "Terms" }]} />
      <section className="container-page py-12 sm:py-16">
        <div className="prose-medora max-w-3xl">
          <h2>Not for emergencies</h2>
          <p>Online booking and video consultations are not for medical emergencies. In an emergency call {HOSPITAL.emergency} or go to the nearest emergency department.</p>
          <h2>Appointments & fees</h2>
          <ul>
            <li>Consultation fees are displayed before payment and are payable in advance for online bookings.</li>
            <li>Cancellations more than 2 hours before the slot are refunded in full; later cancellations and no-shows are not refundable.</li>
            <li>Doctors may occasionally reschedule because of emergencies; you will be notified and may rebook or receive a full refund.</li>
          </ul>
          <h2>Video consultations</h2>
          <p>The doctor may advise an in-person visit if a physical examination is needed. Please join from a private place with a stable connection. Recording of consultations is not permitted.</p>
          <h2>Pharmacy</h2>
          <p>Prescription medicines are supplied only against a valid prescription and within the prescribed quantity. Medicines once dispensed cannot be returned except for quality issues.</p>
          <h2>Your account</h2>
          <p>Keep your password confidential. You are responsible for activity under your account. Notify us immediately of any unauthorised use.</p>
        </div>
      </section>
    </>
  );
}
