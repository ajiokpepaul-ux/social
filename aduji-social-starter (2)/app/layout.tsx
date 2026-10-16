import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADUJI — Make your moment move",
  description: "ADUJI is a short-video social platform for creators and communities."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}