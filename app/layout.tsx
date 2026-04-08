import "./globals.css";
import type { Metadata } from "next";
import Providers from "@/app/providers";

export const metadata: Metadata = {
  title: "POS SaaS",
  description: "Mobile-first POS for fast retail"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

