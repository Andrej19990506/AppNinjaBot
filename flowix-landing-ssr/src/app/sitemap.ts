import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://flowixdata.ru'
  
  // Основные страницы лендинга
  const routes = [
    '',
    '/#features', // Секция функций
    '/#benefits', // Секция преимуществ
    '/#faq', // Секция FAQ
    '/#contact', // Секция контактов
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }))

  return routes
}
