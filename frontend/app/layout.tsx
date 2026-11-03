import type { Metadata } from "next";
import "./care-record.css";
import "./staff-workspace.css";

export const metadata: Metadata = {
  title: { default: "CareRecord — A clear record of care", template: "%s | CareRecord" },
  description: "A clinic workspace for patient visits, laboratory reports, billing and reliable reporting.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head><link rel="stylesheet" href="/fonts/fonts.css" /></head>
      <body>{children}</body>
    </html>
  );
}

