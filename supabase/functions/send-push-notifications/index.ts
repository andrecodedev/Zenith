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

  // --- MÓDULO: ROTINAS ---
  const { data: routines } = await supabase
    .from('routines')
    .select('id, title, description, user_id, time, times, recurrence, custom_days, date, start_date, end_date, excluded_dates, created_at');

  const validRoutines = routines?.filter((r: any) => {
    if (!r.time && (!r.times || r.times.length === 0)) return false;

    // isTaskDueToday logic
    if (r.start_date) {
      if (todayStr < r.start_date) return false;
    } else if (r.created_at) {
      const cDate = new Date(r.created_at);
      const cLocal = new Date(cDate.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
      const createdDateStr = `${cLocal.getFullYear()}-${String(cLocal.getMonth() + 1).padStart(2, '0')}-${String(cLocal.getDate()).padStart(2, '0')}`;
      if (todayStr < createdDateStr) return false;
    }

    if (r.end_date && todayStr > r.end_date) return false;
    if (r.excluded_dates && r.excluded_dates.includes(todayStr)) return false;

    const dayOfWeek = local.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

    switch (r.recurrence) {
      case 'daily':
        return true;
      case 'weekdays':
        return dayOfWeek !== 0 && dayOfWeek !== 6;
      case 'weekends':
        return dayOfWeek === 0 || dayOfWeek === 6;
      case 'custom':
        return r.custom_days?.includes(dayOfWeek) ?? false;
      case 'once':
        return r.date === todayStr;
      case 'multiple_times':
        return true;
      default:
        return false;
    }
  }) || [];

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
  
  // --- MÓDULO: FINANÇAS (Roda apenas às 09:00 BRT) ---
  let financeSends = 0;
  if (hh === '09' && mm === '00') {
    const year = local.getFullYear();
    const month = local.getMonth() + 1;
    const day = local.getDate();
    const dateStrFormated = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    
    console.log(`[push-finance] Checking finance entries for ${dateStrFormated}`);
    
    const { data: finances } = await supabase
      .from('finance_entries')
      .select('*')
      .eq('year', year)
      .eq('month', month)
      .eq('notify', true)
      .eq('paid', false);
      
    if (finances && finances.length > 0) {
      const dueToday = finances.filter(f => f.date_str === dateStrFormated);
      if (dueToday.length > 0) {
        console.log(`[push-finance] Found ${dueToday.length} due finance entries`);
        const userIdsFin = [...new Set(dueToday.map(f => f.user_id))];
        const { data: subsFin } = await supabase.from('push_subscriptions').select('*').in('user_id', userIdsFin);
        
        if (subsFin && subsFin.length > 0) {
          const pushesFin = dueToday.flatMap(fin => 
            subsFin.filter(s => s.user_id === fin.user_id).map(async sub => {
               try {
                 await webpush.sendNotification(
                   { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                   JSON.stringify({
                     title: `Conta Vencendo Hoje!`,
                     body: `A despesa "${fin.name}" (R$ ${Number(fin.amount).toFixed(2)}) vence hoje.`,
                     payload: { type: 'finance', id: fin.id, dateStr: todayStr },
                   }),
                   { TTL: 120 }
                 );
                 financeSends++;
               } catch (err: any) {
                 if (err.statusCode === 404 || err.statusCode === 410) {
                   await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
                 }
               }
            })
          );
          await Promise.all(pushesFin);
          console.log(`[push-finance] Sent ${financeSends} finance push notifications`);
        }
      }
    }
  }

  return new Response(`sent ${sends.length} routines, ${financeSends} finance`, { status: 200 });
});
