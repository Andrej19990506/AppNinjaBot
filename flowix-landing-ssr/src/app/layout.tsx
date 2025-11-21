import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import ScrollProgress from "@/components/ScrollProgress";

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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "FloWix",
              "applicationCategory": "BusinessApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "RUB"
              },
              "description": "Инвентаризация, списание, поставки, автоматические отчеты - всё в одной системе. Для магазинов, складов, ресторанов, любых точек продаж. Интеграция с Telegram для мгновенных уведомлений.",
              "url": "https://flowixdata.ru",
              "screenshot": "https://flowixdata.ru/Icon/Logo.png",
              "featureList": [
                "Инвентаризация товаров",
                "Списание товаров",
                "Контроль поставок",
                "Автоматические отчеты в Excel и Word",
                "Интеграция с Telegram",
                "Управление группами и пользователями",
                "Уведомления в реальном времени"
              ],
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": "5",
                "ratingCount": "1"
              },
              "provider": {
                "@type": "Organization",
                "name": "FloWix",
                "url": "https://flowixdata.ru"
              }
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "FloWix",
              "url": "https://flowixdata.ru",
              "logo": "https://flowixdata.ru/Icon/Logo.png",
              "description": "Умная автоматизация для вашего бизнеса - инвентаризация, списание, поставки, автоматические отчеты",
              "sameAs": []
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} antialiased`} suppressHydrationWarning>
        <ThemeProvider>
          <ScrollProgress />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
