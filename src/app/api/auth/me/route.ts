import { getCurrentUser } from '@/lib/auth';
import { handle } from '@/lib/api';

/** GET /api/auth/me — current session info for the admin shell. */
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    return Response.json({ user });
  });
}
