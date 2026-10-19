// تسجيل دخول المنظم: بيتأكد إن التوكن (Firebase) أو المفتاح (وضع التجربة) صالح، وبيقول السبب لو لأ.
import { bearerOf, checkAdmin } from '../../server/logic.js';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const r = await checkAdmin({
    key: typeof body?.key === 'string' ? body.key : null,
    bearer: bearerOf(request.headers.get('authorization')),
  });
  return Response.json(r, { status: r.ok ? 200 : r.reason === 'not_configured' ? 503 : 401, headers: { 'Cache-Control': 'no-store' } });
}
