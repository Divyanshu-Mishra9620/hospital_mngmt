import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { HOSPITAL } from "@/lib/constants";
import { DbBoot } from "@/components/db-boot";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${HOSPITAL.name} — Multispeciality Care, ${HOSPITAL.city}`,
    template: `%s · ${HOSPITAL.shortName}`,
  },
  description:
    "Medora Multispeciality Hospital: 24×7 emergency, 30+ specialities, online appointments, video consultations and an in-house pharmacy.",
  applicationName: HOSPITAL.shortName,
};

export const viewport: Viewport = {
  themeColor: "#0f5764",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="min-h-dvh">
        <DbBoot />
        {children}
      </body>
    </html>
  );
}
