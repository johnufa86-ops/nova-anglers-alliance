import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = { variable: "--font-geist-sans" } as any;
const geistMono = { variable: "--font-geist-mono" } as any;

export const metadata: Metadata = {
  title: "NOVA ANGLERS ALLIANCE — Рыболовный спорт. Новый уровень.",
  description: "Российская спортивная экосистема рыболовного спорта: календарь соревнований, рейтинг спортсменов, онлайн-протоколы туров и медиа.",
  keywords: ["рыболовный спорт", "NOVA Anglers", "соревнования по рыбалке", "спиннинг с берега", "рейтинг рыболовов", "турниры"],
  authors: [{ name: "NOVA Anglers Alliance" }],
  icons: {
    icon: "/icons/favicon-32x32.png",
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "NOVA ANGLERS ALLIANCE — Рыболовный спорт",
    description: "Официальный портал рыболовной лиги NOVA. Календарь соревнований сезона 2026, онлайн-регистрация и рейтинг.",
    url: "https://www.nova-anglers.ru",
    siteName: "NOVA Anglers Alliance",
    locale: "ru_RU",
    type: "website",
    images: [
      {
        url: "https://www.nova-anglers.ru/assets/logo-full.png",
        width: 1200,
        height: 630,
        alt: "NOVA Anglers Alliance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NOVA ANGLERS ALLIANCE — Рыболовный спорт",
    description: "Официальный портал рыболовной лиги NOVA: календарь соревнований и рейтинг участников.",
    images: ["https://www.nova-anglers.ru/assets/logo-full.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
