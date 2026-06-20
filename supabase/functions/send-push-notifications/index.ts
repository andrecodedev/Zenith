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
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const nowMin = local.getHours() * 60 + local.getMinutes();
  const hh = String(local.getHours()).padStart(2, '0');
  const mm = String(local.getMinutes()).padStart(2, '0');
  const todayStr = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;

  console.log(`[push] Running at ${hh}:${mm} BRT (UTC-3)`);

  const { data: routines } = await supabase
    .from('routines')
    .select('id, title, description, user_id, time')
    .not('time', 'is', null);

  if (!routines?.length) return new Response('no routines', { status: 200 });

  const matching = routines.filter(r => {
    const [rh, rm] = (r.time as string).split(':').map(Number);
    return Math.abs(rh * 60 + rm - nowMin) <= 1;
  });

  if (!matching.length) return new Response('no matches', { status: 200 });

  const { data: alreadySent } = await supabase
    .from('push_sent_log')
    .select('routine_id')
    .eq('sent_date', todayStr)
    .in('routine_id', matching.map(r => r.id));

  const sentIds = new Set(alreadySent?.map((r: any) => r.routine_id) ?? []);
  const toSend = matching.filter(r => !sentIds.has(r.id));

  if (!toSend.length) return new Response('already notified today', { status: 200 });

  const userIds = [...new Set(toSend.map(r => r.user_id))];
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  if (!subscriptions?.length) return new Response('no subscriptions', { status: 200 });

  const sends = toSend.flatMap(routine =>
    subscriptions
      .filter(s => s.user_id === routine.user_id)
      .map(async sub => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({
              title: `Hora: ${routine.title}`,
              body: routine.description || 'Não esqueça de marcar como concluída!',
              payload: { routineId: routine.id, dateStr: todayStr },
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

  await supabase.from('push_sent_log').upsert(
    toSend.map(r => ({ routine_id: r.id, sent_date: todayStr })),
    { onConflict: 'routine_id,sent_date' }
  );

  console.log(`[push] Sent ${sends.length}, logged ${toSend.length} routines`);
  return new Response(`sent ${sends.length}`, { status: 200 });
});
