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
    .select('id, title, description, user_id, time, times');

  const validRoutines = routines?.filter(r => r.time || (r.times && r.times.length > 0)) || [];

  if (!validRoutines.length) {
    console.log('[push] STOP: no routines with time/times set');
    return new Response('no routines', { status: 200 });
  }
  console.log(`[push] ${validRoutines.length} routines with time/times. Checking against ${hh}:${mm} (nowMin=${nowMin})`);
  routines.forEach(r => console.log(`  routine: "${r.title}" time="${r.time}" user=${r.user_id}`));

  const matching: any[] = [];

  validRoutines.forEach(r => {
    // Checa time normal
    if (r.time) {
      const [rh, rm] = (r.time as string).split(':').map(Number);
      const diff = Math.abs(rh * 60 + rm - nowMin);
      if (diff <= 1) matching.push({ ...r, matchedTime: r.time });
    }
    // Checa múltiplos horários (array times)
    if (r.times && Array.isArray(r.times)) {
      r.times.forEach((t: string) => {
        const [rh, rm] = t.split(':').map(Number);
        const diff = Math.abs(rh * 60 + rm - nowMin);
        if (diff <= 1) matching.push({ ...r, matchedTime: t });
      });
    }
  });

  if (!matching.length) {
    console.log('[push] STOP: no time match');
    return new Response('no matches', { status: 200 });
  }
  console.log(`[push] ${matching.length} matching routine slot(s)`);

  const { data: alreadySent } = await supabase
    .from('push_sent_log')
    .select('routine_id, routine_time')
    .eq('sent_date', todayStr)
    .in('routine_id', matching.map(r => r.id));

  const sentMap = new Map(alreadySent?.map((r: any) => [`${r.routine_id}_${r.routine_time}`, true]) ?? []);
  const toSend = matching.filter(r => !sentMap.has(`${r.id}_${r.matchedTime}`));

  if (!toSend.length) {
    console.log('[push] STOP: already notified today');
    return new Response('already notified today', { status: 200 });
  }

  const userIds = [...new Set(toSend.map(r => r.user_id))];
  console.log(`[push] Looking for subscriptions for users: ${userIds.join(', ')}`);
  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  if (!subscriptions?.length) {
    console.log('[push] STOP: no subscriptions found for these users');
    return new Response('no subscriptions', { status: 200 });
  }

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
            }),
            { TTL: 120 }
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
    toSend.map(r => ({ routine_id: r.id, sent_date: todayStr, routine_time: r.matchedTime })),
    { onConflict: 'routine_id,sent_date' }
  );

  console.log(`[push] Sent ${sends.length}, logged ${toSend.length} routines`);
  return new Response(`sent ${sends.length}`, { status: 200 });
});
