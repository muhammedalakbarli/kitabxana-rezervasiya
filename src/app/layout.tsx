import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { FlashToast } from "@/components/flash-toast";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Kitabxana Rezervasiya — Qarabağ Universiteti", template: "%s · QU Kitabxana" },
  description: "Qarabağ Universiteti Kitabxanasının fərdi oxu otaqları, noutbuk və adapterlərinin onlayn rezervasiya sistemi.",
  applicationName: "QU Kitabxana Rezervasiya",
  appleWebApp: { title: "QU Kitabxana", capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#44766C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <body className="min-h-dvh font-sans">
        {children}
        <Suspense>
          <FlashToast />
        </Suspense>
      </body>
    </html>
  );
}
