import { handle } from '@/lib/api';
import { requireAnyUser } from '@/lib/auth';
import { computeAthleteResults } from '@/lib/cabinet';

/** GET /api/me/results — результаты спортсмена и очки рейтинга NOVA. */
export async function GET() {
  return handle(async () => {
    const user = await requireAnyUser();
    const results = await computeAthleteResults(user.id);
    return Response.json(results);
  });
}
