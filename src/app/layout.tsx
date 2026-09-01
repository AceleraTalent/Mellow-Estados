import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mellow & Banana Operations",
  description: "Mellow & Banana client operations system",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
