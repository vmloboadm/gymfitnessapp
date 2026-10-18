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
  metadataBase: new URL("https://gymfitnesscampos.com.br"),
  title: "GymFitness",
  description: "App de academia com check-in NFC e métrica real",
  manifest: "/app/manifest.json",
  icons: {
    apple: "/app/icons/icon-180x180.png",
  },
  appleWebApp: {
    capable: true,
    title: "GymFitness",
    statusBarStyle: "black-translucent",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "GymFitness",
    description: "Treine. Evolua. Apareça. Check-in, treinos do personal e ranking da academia.",
    url: "https://gymfitnesscampos.com.br/app",
    type: "website",
    images: [
      {
        url: "/app/og-gymfitness.png",
        width: 1200,
        height: 630,
        alt: "GymFitness",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GymFitness",
    description: "Treine. Evolua. Apareça.",
    images: ["/app/og-gymfitness.png"],
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#070B14",
  // teclado Android redimensiona o conteúdo: sem isso o botão "Próximo" e o
  // campo de reps da última série ficam atrás do teclado
  interactiveWidgetResizesVisualViewport: true,
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