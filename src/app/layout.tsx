import type { Metadata } from "next";
import { Sora, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AppProviders } from "./providers";
import { SWUpdater } from "~/components/common/SWUpdater";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  // apenas pesos realmente usados nos títulos (menos arquivos na cabeça do doc)
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  // contadores/badges usam semibold e bold apenas
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "GymFitness",
  description: "App de academia com check-in NFC e métrica real",
  manifest: "/app/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#070B14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark" style={{ colorScheme: "dark" }}>
      <body className={`${inter.variable} ${sora.variable} ${jetbrainsMono.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
        <SWUpdater />
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}