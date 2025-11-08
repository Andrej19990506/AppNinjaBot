import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_DEV_BASE_URL = 'http://localhost:8000/api/v1';
const DEFAULT_PROD_BASE_URL = 'https://dev-bot.appninjabot.ru/api/v1';

const getBaseUrl = (hostname: string) => {
  if (process.env.CONTACT_API_BASE_URL) {
    return process.env.CONTACT_API_BASE_URL;
  }

  const isProduction = hostname.includes('appninjabot.ru') || hostname.includes('flowix.ru');
  return isProduction ? DEFAULT_PROD_BASE_URL : DEFAULT_DEV_BASE_URL;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const baseUrl = getBaseUrl(request.nextUrl.hostname);

    const response = await fetch(`${baseUrl}/contact/landing/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response
      .clone()
      .json()
      .catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          detail:
            (data && typeof data === 'object' && 'detail' in data && data.detail) ||
            'Ошибка отправки. Попробуйте ещё раз.',
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data ?? { ok: true });
  } catch (error) {
    console.error('CONTACT_FORM_PROXY_ERROR', error);
    return NextResponse.json(
      {
        detail: 'Не удалось отправить заявку. Попробуйте позже или напишите нам в Telegram @Flowix_support.',
      },
      { status: 500 },
    );
  }
}


