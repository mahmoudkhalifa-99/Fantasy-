// Vercel Function: /api/tournament/data (التخزين في Firebase Firestore)
import { bearerOf, handleGet, handlePost, resolveAdmin, verifyBearer } from '../../server/logic.js';
import { storage, storageKind } from '../../server/vercelStorage.js';

const headers = { 'Cache-Control': 'no-store', 'X-Storage': storageKind };

const ctxOf = async (req: Request) => {
  const bearer = bearerOf(req.headers.get('authorization'));
  const u = await verifyBearer(bearer);
  return {
    isAdmin: await resolveAdmin({ bearer }),
    token: req.headers.get('x-user-token'),
    uid: u?.uid ?? null,
    email: u?.email ?? null,
    name: u?.name ?? null,
  };
};

export async function GET(request: Request) {
  try {
    const r = await handleGet(storage, await ctxOf(request));
    return Response.json(r.json, { status: r.status, headers });
  } catch (err) {
    console.error('Load error:', err);
    return Response.json({ error: 'Failed to load tournament data', detail: String((err as Error)?.message || err).slice(0, 300) }, { status: 500, headers });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const r = await handlePost(storage, body, await ctxOf(request));
    return Response.json(r.json, { status: r.status, headers });
  } catch (err) {
    console.error('Save error:', err);
    return Response.json({ error: 'Failed to update tournament data', detail: String((err as Error)?.message || err).slice(0, 300) }, { status: 500, headers });
  }
}
