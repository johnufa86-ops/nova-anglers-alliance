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
    let city = '';
    let region = '';

    const answers = body.answers || body;
    if (typeof answers === 'object' && answers !== null) {
      for (const key of Object.keys(answers)) {
        const item = answers[key];
        const qText = (typeof item === 'object' && item?.question ? String(item.question) : key).toLowerCase();
        const val = typeof item === 'object' && item?.value !== undefined ? String(item.value) : String(item);

        if (qText.includes('фио') || qText.includes('имя') || qText.includes('фамилия')) {
          if (!fullName && val.trim()) fullName = val.trim();
        } else if (qText.includes('телефон') || qText.includes('связ') || qText.includes('номер')) {
          if (!phone && val.trim()) phone = val.trim();
        } else if (qText.includes('город') || qText.includes('регион') || qText.includes('откуда') || qText.includes('проживан')) {
          if (!region && val.trim()) {
            city = val.trim();
            region = val.trim();
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

      const athlete = await (db as any).athlete.create({
        data: {
          firstName,
          lastName,
          displayName: fullName,
          city: city || 'Уфа',
          region: region || 'Республика Башкортостан',
          country: 'Россия',
          status: 'active',
        },
      });

      return NextResponse.json({
        ok: true,
        message: 'Athlete recorded from Yandex Form webhook',
        athleteId: athlete.id,
      });
    }

    return NextResponse.json({ ok: true, received: true });
  } catch (error: any) {
    console.error('[Yandex Form Webhook Error]:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
