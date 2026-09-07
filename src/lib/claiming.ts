// @ts-nocheck
/**
 * STAGE 5/6 — Profile Claiming («цифровая спортивная книжка»).
 *
 * С Этапа 6 привязка гостевых заявок происходит ТОЛЬКО ПОСЛЕ верификации
 * e-mail (закрывает п. 3.3 аудита Этапа 5): сервер подтверждает владение
 * адресом письмом со ссылкой, и лишь затем record'ы athletes/applications
 * получают userId.
 *
 * Выполнять ТОЛЬКО в транзакции (Prisma InteractiveTransactionClient).
 * Гонки двух регистраций с одним e-mail разрешаются уникальными
 * индексами users.email и athletes.userId (P2002 → 409 наверху).
 */

import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export interface ClaimOutcome {
  /** id записи athletes, привязанной к аккаунту (существующая или новая). */
  athleteId: string | null;
  /** Сколько гостевых заявок получили userId. */
  claimedApplications: number;
}

export async function claimAthleteData(tx: Tx, user: { id: string; email: string; name: string }): Promise<ClaimOutcome> {
  // 1. спортсмены с таким contact e-mail
  const matchingAthletes = await tx.athlete.findMany({
    where: { email: user.email },
    orderBy: { createdAt: 'asc' },
    select: { id: true, userId: true, displayName: true },
  });

  // 2. e-mail уже привязан к другому аккаунту → конфликт
  const claimedByOther = matchingAthletes.find((a) => a.userId && a.userId !== user.id);
  if (claimedByOther) throw new ClaimedByOtherError();

  // 3. клейм самой полной записи спортсмена (1:1)
  let athleteId: string | null = null;
  const unclaimed = matchingAthletes.filter((a) => !a.userId);
  if (unclaimed.length > 0) {
    const full = await tx.athlete.findMany({
      where: { id: { in: unclaimed.map((a) => a.id) } },
      orderBy: [{ birthDate: 'desc' }, { createdAt: 'asc' }],
    });
    const primary = full.find((a) => a.birthDate && a.phone) || full[0];
    await tx.athlete.update({ where: { id: primary.id }, data: { userId: user.id } });
    athleteId = primary.id;
  } else if (matchingAthletes.length === 0) {
    // 4. совпадений нет → новая связка
    const created = await tx.athlete.create({
      data: { displayName: user.name, email: user.email, userId: user.id },
    });
    athleteId = created.id;
  } else {
    // все matching-записи уже принадлежат этому же user'у
    athleteId = matchingAthletes[0].id;
  }

  // 5. гостевые заявки с этим contact e-mail → userId
  const claimed = await tx.application.updateMany({
    where: { contactEmail: user.email, userId: null },
    data: { userId: user.id },
  });

  return { athleteId, claimedApplications: claimed.count };
}

/** E-mail (athlete-запись) уже принадлежит другому аккаунту. */
export class ClaimedByOtherError extends Error {
  constructor() {
    super('Этот e-mail уже привязан к другому аккаунту');
    this.name = 'ClaimedByOtherError';
  }
}
