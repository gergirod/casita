import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casita",
  description: "App de operaciones para duenios de alquileres"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
