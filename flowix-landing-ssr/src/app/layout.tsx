import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import ScrollProgress from "@/components/ScrollProgress";
import Navigation from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FloWix - Умная автоматизация для вашего бизнеса | Инвентаризация и учет товаров",
  description: "Инвентаризация, списание, поставки, автоматические отчеты - всё в одной системе. Для магазинов, складов, ресторанов, любых точек продаж. Интеграция с Telegram для мгновенных уведомлений.",
  keywords: [
    "автоматизация бизнеса",
    "управление бизнесом",
    "инвентаризация",
    "списание товаров",
    "контроль поставок",
    "автоматические отчеты",
    "отчетность excel word",
    "уведомления telegram",
    "цифровизация бизнеса",
    "система учета для ресторанов",
    "учет склада",
    "учет товаров",
    "telegram для бизнеса"
  ],
  openGraph: {
    type: "website",
    url: "https://flowixdata.ru/",
    title: "FloWix - Умная автоматизация для вашего бизнеса",
    description: "Инвентаризация, списание, поставки, автоматические отчеты в одной системе. Для магазинов, складов, ресторанов. Интеграция с Telegram.",
    images: ["https://flowixdata.ru/Icon/Logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FloWix - Умная автоматизация для вашего бизнеса",
    description: "Инвентаризация, списание, поставки, автоматические отчеты в одной системе. Для магазинов, складов, ресторанов.",
    images: ["https://flowixdata.ru/Icon/Logo.png"],
  },
  metadataBase: new URL("https://flowixdata.ru"),
  alternates: {
    canonical: "/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme') || 'dark';
                  document.documentElement.setAttribute('data-theme', savedTheme);
                  if (savedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <Navigation />
          <ScrollProgress />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
