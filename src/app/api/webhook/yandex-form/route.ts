import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((val, key) => {
        body[key] = val;
      });
    }

    let fullName = '';
    let phone = '';
    let email = '';
    let city = '';
    let region = '';

    // Поддерживаем как обычный webhook, так и JSON-RPC 2.0 (body.params)
    const targetContainers = [body.params?.answers, body.params, body.answers, body].filter(Boolean);

    for (const container of targetContainers) {
      if (typeof container === 'object' && container !== null) {
        for (const key of Object.keys(container)) {
          const item = container[key];
          const qText = (typeof item === 'object' && item?.question ? String(item.question) : key).toLowerCase();
          const val = typeof item === 'object' && item?.value !== undefined ? String(item.value) : String(item);

          if (qText.includes('фио') || qText.includes('имя') || qText.includes('фамилия') || qText === 'fullname' || qText === 'name') {
            if (!fullName && val.trim()) fullName = val.trim();
          } else if (qText.includes('телефон') || qText.includes('связ') || qText.includes('номер') || qText === 'phone') {
            if (!phone && val.trim()) phone = val.trim();
          } else if (qText.includes('email') || qText.includes('почт') || qText.includes('e-mail')) {
            if (!email && val.trim()) email = val.trim();
          } else if (qText.includes('город') || qText.includes('регион') || qText.includes('откуда') || qText.includes('проживан') || qText === 'city') {
            if (!region && val.trim()) {
              city = val.trim();
              region = val.trim();
            }
          }
        }
      }
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
            displayName: fullName,
            city: city || 'Уфа',
            region: region || 'Республика Башкортостан',
            country: 'Россия',
            phone: phone || null,
            email: email || null,
            status: 'active',
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
                  status: 'approved',
                  note: 'Заявка получена автоматически через Яндекс.Форму',
                },
              },
            },
          });

          // Обновляем счётчик участников в карточке турнира
          const count = await (db as any).applicationParticipant.count({
            where: {
              application: {
                competitionId: comp.id,
                status: 'approved',
              },
            },
          });
          await (db as any).competition.update({
            where: { id: comp.id },
            data: { participants: count },
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
