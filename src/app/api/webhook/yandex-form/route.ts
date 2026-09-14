import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function extractText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val)) {
    return val.map(extractText).filter(Boolean).join(', ');
  }
  if (typeof val === 'object') {
    return val.value || val.text || val.name || val.label || val.title || val.slug || '';
  }
  return String(val).trim();
}

function extractQuestionLabel(item: any, fallbackKey: string): string {
  if (typeof item === 'object' && item !== null) {
    if (item.question) {
      if (typeof item.question === 'object') {
        return (item.question.label || item.question.name || item.question.text || item.question.title || fallbackKey).toLowerCase();
      }
      return String(item.question).toLowerCase();
    }
    if (item.label) return String(item.label).toLowerCase();
    if (item.name) return String(item.name).toLowerCase();
    if (item.title) return String(item.title).toLowerCase();
  }
  return fallbackKey.toLowerCase();
}

export async function GET() {
  try {
    const lastLog = await (db as any).siteSetting.findUnique({
      where: { key: 'last_yandex_webhook' },
    }).catch(() => null);

    return NextResponse.json({
      status: 'active',
      endpoint: 'https://www.nova-anglers.ru/api/webhook/yandex-form',
      lastWebhook: lastLog ? JSON.parse(lastLog.value) : null,
    });
  } catch (err: any) {
    return NextResponse.json({ status: 'error', error: err.message });
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';

    try {
      if (contentType.includes('application/json')) {
        body = await req.json();
      } else if (contentType.includes('form')) {
        const formData = await req.formData();
        formData.forEach((val, key) => {
          body[key] = val;
        });
      } else {
        const text = await req.text();
        try {
          body = JSON.parse(text);
        } catch {
          body = { rawText: text };
        }
      }
    } catch (e: any) {
      console.warn('[Yandex Webhook Body Parse Warn]:', e);
    }

    // Сохраняем последний полученный вебхук для отладки
    try {
      await (db as any).siteSetting.upsert({
        where: { key: 'last_yandex_webhook' },
        update: {
          value: JSON.stringify({
            receivedAt: new Date().toISOString(),
            contentType,
            body,
          }),
        },
        create: {
          key: 'last_yandex_webhook',
          value: JSON.stringify({
            receivedAt: new Date().toISOString(),
            contentType,
            body,
          }),
        },
      });
    } catch (e) {
      console.error('[Yandex Webhook Log to DB Error]:', e);
    }

    let firstName = '';
    let lastName = '';
    let patronymic = '';
    let fullName = '';
    let phone = '';
    let email = '';
    let city = '';
    let region = '';

    // Рекурсивный поиск по всем возможным контейнерам данных
    const searchInObject = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) {
        for (const el of obj) searchInObject(el);
        return;
      }
      for (const [k, v] of Object.entries(obj)) {
        const label = extractQuestionLabel(v, k);
        const val = extractText(typeof v === 'object' && v !== null && (v as any).value !== undefined ? (v as any).value : v);

        if (label.includes('фамили') || label === 'lastname') {
          if (!lastName && val) lastName = val;
        } else if (label.includes('имя') || label === 'firstname' || label === 'first_name') {
          if (!firstName && val) firstName = val;
        } else if (label.includes('отчеств') || label === 'patronymic' || label === 'middlename') {
          if (!patronymic && val) patronymic = val;
        } else if (label.includes('фио') || label === 'fullname' || label === 'full_name') {
          if (!fullName && val) fullName = val;
        } else if (label.includes('телефон') || label.includes('связ') || label.includes('номер') || label === 'phone') {
          if (!phone && val) phone = val;
        } else if (label.includes('email') || label.includes('почт') || label === 'e-mail') {
          if (!email && val) email = val;
        } else if (label.includes('город') || label.includes('откуда') || label.includes('проживан') || label === 'city') {
          if (!city && val) {
            city = val;
            if (!region) region = val;
          }
        } else if (label.includes('регион') || label === 'region') {
          if (!region && val) region = val;
        }

        if (typeof v === 'object' && v !== null && k !== 'competition') {
          searchInObject(v);
        }
      }
    };

    searchInObject(body.params || body.answers || body.data || body);

    if (!fullName && (lastName || firstName)) {
      fullName = `${lastName} ${firstName}`.trim();
    }
    if (!firstName && fullName) {
      const parts = fullName.split(/\s+/);
      lastName = parts[0] || 'Спортсмен';
      firstName = parts[1] || '';
    }

    const regionLower = (region || '').toLowerCase();
    if (regionLower.includes('уфа') || regionLower.includes('башкортостан') || regionLower.includes('рб')) {
      region = 'Республика Башкортостан';
      city = city || 'Уфа';
    } else if (regionLower.includes('челябинск')) {
      region = 'Челябинская область';
      city = city || 'Челябинск';
    } else if (regionLower.includes('казань') || regionLower.includes('татарстан')) {
      region = 'Республика Татарстан';
      city = city || 'Казань';
    } else if (regionLower.includes('самара')) {
      region = 'Самарская область';
      city = city || 'Самара';
    } else if (regionLower.includes('екатеринбург') || regionLower.includes('свердловск')) {
      region = 'Свердловская область';
      city = city || 'Екатеринбург';
    } else if (regionLower.includes('москва')) {
      region = 'г. Москва';
      city = city || 'Москва';
    } else if (!region) {
      region = 'Республика Башкортостан';
      city = city || 'Уфа';
    }

    if (fullName) {
      const parts = fullName.split(/\s+/);
      const lastName = parts[0] || 'Спортсмен';
      const firstName = parts[1] || '';

      // 1. Создаём или обновляем запись спортсмена
      let athlete = await (db as any).athlete.findFirst({
        where: { displayName: fullName },
      });

      if (!athlete) {
        athlete = await (db as any).athlete.create({
          data: {
            firstName,
            lastName,
            middleName: patronymic || null,
            displayName: fullName,
            city: city || 'Уфа',
            region: region || 'Республика Башкортостан',
            phone: phone || null,
            email: email || null,
          },
        });
      }

      // 2. Находим турнир «NOVA Street & River — Уфа 2026»
      const comp = await (db as any).competition.findFirst({
        where: { slug: 'nova-street-river-ufa-2026' },
      });

      if (comp) {
        // Проверяем, нет ли уже заявки от этого спортсмена на этот турнир
        const existingApp = await (db as any).application.findFirst({
          where: {
            competitionId: comp.id,
            athleteId: athlete.id,
          },
        });

        if (!existingApp) {
          const appNumber = `APP-YA-${Date.now().toString(36).toUpperCase()}`;
          await (db as any).application.create({
            data: {
              competitionId: comp.id,
              athleteId: athlete.id,
              entryType: 'athlete',
              status: 'approved', // сразу в подтверждённые участники
              applicationNumber: appNumber,
              contactEmail: email || `ya_${Date.now()}@nova-anglers.ru`,
              contactPhone: phone || '',
              rawPayload: JSON.stringify(body),
              source: 'yandex_forms',
              participants: {
                create: {
                  athleteId: athlete.id,
                  role: 'athlete',
                },
              },
              statusHistory: {
                create: {
                  newStatus: 'approved',
                  comment: 'Заявка получена автоматически через Яндекс.Форму',
                },
              },
            },
          });

        }
      }

      return NextResponse.json({
        jsonrpc: '2.0',
        id: body?.id ?? 1,
        result: {
          ok: true,
          athleteId: athlete.id,
        },
        ok: true,
        message: 'Athlete and tournament application recorded from Yandex Form webhook',
        athleteId: athlete.id,
      });
    }

    return NextResponse.json({
      jsonrpc: '2.0',
      id: body?.id ?? 1,
      result: { ok: true, received: true },
      ok: true,
      received: true,
    });
  } catch (error: any) {
    console.error('[Yandex Form Webhook Error]:', error);
    return NextResponse.json({
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32000, message: error.message },
      ok: false,
    }, { status: 200 });
  }
}
