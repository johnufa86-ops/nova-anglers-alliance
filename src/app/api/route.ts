import { NextResponse } from "next/server";

/** GET /api — service health-check. */
export async function GET() {
  return NextResponse.json({
    name: "NOVA Anglers Alliance API",
    version: "4.0",
    ok: true,
    endpoints: [
      "GET  /api/competitions",
      "GET  /api/competitions/:slug",
      "GET  /api/competitions/:slug/participants",
      "POST /api/applications",
      "GET  /api/applications/lookup?number=&token=",
      "POST /api/auth/login",
      "POST /api/auth/logout",
      "GET  /api/auth/me",
      "GET  /api/admin/overview",
      "GET  /api/admin/applications",
      "GET  /api/admin/applications/:id",
      "PATCH /api/admin/applications/:id/status",
      "GET  /api/admin/competitions/:slug",
      "GET  /api/admin/competitions/:slug/export",
    ],
  });
}
