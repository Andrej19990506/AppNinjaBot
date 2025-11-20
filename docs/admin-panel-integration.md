# Интеграция админ-панели в flowix-landing-ssr

## Структура

Админ-панель будет доступна по URL: `https://flowix.app/admin` (или `http://localhost:3000/admin` в разработке)

## Структура проекта

```
flowix-landing-ssr/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Главная страница лендинга
│   │   ├── layout.tsx            # Layout для лендинга
│   │   ├── admin/                # Админ-панель
│   │   │   ├── layout.tsx        # Layout для админ-панели (с сайдбаром)
│   │   │   ├── page.tsx          # Dashboard админ-панели
│   │   │   ├── login/
│   │   │   │   └── page.tsx      # Страница входа
│   │   │   ├── companies/
│   │   │   │   ├── page.tsx     # Список компаний
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx # Детали/редактирование компании
│   │   │   │   └── create/
│   │   │   │       └── page.tsx  # Создание компании
│   │   │   ├── roles/
│   │   │   │   ├── page.tsx     # Список ролей
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx # Детали/редактирование роли
│   │   │   │   └── create/
│   │   │   │       └── page.tsx  # Создание роли
│   │   │   ├── groups/
│   │   │   │   ├── page.tsx     # Список групп
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx # Детали группы
│   │   │   │       └── assign-role/
│   │   │   │           └── page.tsx # Привязка роли
│   │   │   └── features/
│   │   │       └── page.tsx     # Управление функциями
│   │   └── api/                  # API routes (если нужны)
│   ├── components/
│   │   ├── ...                   # Компоненты лендинга
│   │   └── admin/                # Компоненты админ-панели
│   │       ├── Layout/
│   │       │   ├── Sidebar.tsx
│   │       │   ├── Header.tsx
│   │       │   └── AdminLayout.tsx
│   │       ├── CompanyCard.tsx
│   │       ├── RoleCard.tsx
│   │       └── GroupCard.tsx
│   ├── store/                    # Redux store (если нужен)
│   │   └── admin/
│   │       ├── authSlice.ts
│   │       ├── companiesSlice.ts
│   │       └── rolesSlice.ts
│   └── services/
│       └── adminApi.ts           # API клиент для админ-панели
```

## Роутинг

Next.js App Router автоматически создаст роуты:
- `/` - лендинг
- `/admin` - админ-панель (dashboard)
- `/admin/login` - вход
- `/admin/companies` - список компаний
- `/admin/companies/[id]` - детали компании
- `/admin/roles` - список ролей
- `/admin/groups` - список групп
- и т.д.

## Защита роутов

Создадим middleware для проверки авторизации:

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Проверяем, если это админ-роут
  if (pathname.startsWith('/admin')) {
    // Проверяем наличие токена
    const token = request.cookies.get('admin_token')
    
    // Если нет токена и не на странице логина - редирект
    if (!token && !pathname.startsWith('/admin/login')) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    
    // Если есть токен и на странице логина - редирект на dashboard
    if (token && pathname.startsWith('/admin/login')) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: '/admin/:path*',
}
```

## Зависимости

Нужно добавить в `package.json`:

```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^2.0.0",
    "axios": "^1.6.0",
    "react-redux": "^9.0.0",
    "react-hook-form": "^7.48.0",
    "zustand": "^4.4.0" // или Redux Toolkit
  }
}
```

## Структура Layout для админ-панели

```typescript
// src/app/admin/layout.tsx
import { AdminLayout } from '@/components/admin/Layout/AdminLayout'

export default function AdminLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayout>{children}</AdminLayout>
}
```

## API Endpoints

Все API endpoints будут на бэкенде:
- `POST /v1/admin/auth/login`
- `GET /v1/admin/companies`
- `POST /v1/admin/companies`
- и т.д.

## Переменные окружения

Добавить в `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
# или для продакшена
NEXT_PUBLIC_API_URL=https://api.flowix.app/api
```

