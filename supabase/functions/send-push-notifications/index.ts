import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore
import webpush from 'npm:web-push';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

serve(async () => {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();

  console.log(`[push] Running at ${hh}:${mm} UTC`);

  const { data: routines } = await supabase
    .from('routines')
    .select('id, title, description, user_id, time')
    .not('time', 'is', null);

  if (!routines?.length) return new Response('no routines', { status: 200 });

  const matching = routines.filter(r => {
    const [rh, rm] = (r.time as string).split(':').map(Number);
    return Math.abs(rh * 60 + rm - nowMin) <= 2;
  });

  if (!matching.length) return new Response('no matches', { status: 200 });

  const userIds = [...new Set(matching.map(r => r.user_id))];
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  if (!subscriptions?.length) return new Response('no subscriptions', { status: 200 });

  const today = new Date().toISOString().split('T')[0];

  const sends = matching.flatMap(routine =>
    subscriptions
      .filter(s => s.user_id === routine.user_id)
      .map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: `Hora: ${routine.title}`,
              body: routine.description || 'Não esqueça de marcar como concluída!',
              payload: { routineId: routine.id, dateStr: today },
            })
          );
        } catch (err: any) {
          console.error(`[push] failed for ${sub.endpoint}:`, err.message);
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        }
      })
  );

  await Promise.all(sends);
  return new Response(`sent ${sends.length}`, { status: 200 });
});
