import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yu-Gi-Oh Card Printing",
  description: "Turn YDKE deck links into 9-card-per-page PDF and Word print sheets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
