export interface CoursePreferences {
  priority: 'baixa' | 'normal' | 'alta' | 'maxima';
  pace: 'tranquilo' | 'moderado' | 'intenso';
  timeSlot: 'manha' | 'tarde' | 'noite' | 'qualquer';
}

function buildPreferencesPrompt(prefs: CoursePreferences): string {
  const maxPerDay = { baixa: 1, normal: 2, alta: 3, maxima: 5 }[prefs.priority];

  const urgency = {
    baixa: 'O curso é secundário. Distribua as aulas com folga, sem forçar o calendário.',
    normal: 'Distribua as aulas de forma regular e sustentável.',
    alta: 'O curso é importante. Agrupe módulos curtos (duração total < 2h) no mesmo dia.',
    maxima: 'PRIORIDADE MÁXIMA. Termine o mais rápido possível. Se um módulo tiver duração total menor que 3 horas, coloque TODAS as aulas desse módulo no mesmo dia. Seja agressivo ao agrupar.',
  }[prefs.priority];

  const paceRule = {
    tranquilo: 'Deixe pelo menos 30 minutos de intervalo entre aulas no mesmo dia.',
    moderado: 'Intervalo mínimo de 15 minutos entre aulas no mesmo dia.',
    intenso: 'Pode agendar aulas consecutivas sem intervalo.',
  }[prefs.pace];

  const timeRule = {
    manha: 'Prefira horários entre 07:00 e 12:00.',
    tarde: 'Prefira horários entre 13:00 e 18:00.',
    noite: 'Prefira horários entre 19:00 e 22:00.',
    qualquer: 'Distribua nos melhores horários livres, qualquer período do dia.',
  }[prefs.timeSlot];

  return `
Preferências do usuário (aplique obrigatoriamente):
- Contexto: ${urgency}
- Limite diário: máximo de ${maxPerDay} aula(s) por dia.
- Intervalo: ${paceRule}
- Horário: ${timeRule}
`;
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

async function callGemini(prompt: string, apiKey: string, temperature: number, signal?: AbortSignal): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature } }),
    }
  );
  if (!res.ok) throw Object.assign(new Error(`Gemini ${res.status}`), { status: res.status });
  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

async function callGroq(prompt: string, temperature: number, signal?: AbortSignal): Promise<string> {
  if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY ausente');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_API_KEY}` },
    signal,
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function callWithFallback(prompt: string, geminiApiKey: string | undefined, temperature: number, signal?: AbortSignal): Promise<string> {
  if (geminiApiKey) {
    try {
      return await callGemini(prompt, geminiApiKey, temperature, signal);
    } catch (err: any) {
      if (err.status === 503 || err.status === 429 || err.status === 500) {
        console.warn('[AI] Gemini indisponível, tentando Groq...');
        return await callGroq(prompt, temperature, signal);
      }
      throw err;
    }
  }
  return await callGroq(prompt, temperature, signal);
}

export async function parseCourseWithGemini(apiKey: string, syllabus: string, signal?: AbortSignal): Promise<string[]> {
  const prompt = `
Você é um organizador de estudos especialista.
Vou te passar a ementa de um curso. Extraia o nome de cada aula individualmente em uma lista ordenada.
Exclua cabeçalhos de módulo, quero apenas os nomes das aulas/lições.
Retorne APENAS um array JSON válido de strings, sem crases, sem formatação markdown. 
Exemplo de retorno: ["Aula 1 - Intro", "Aula 2 - Configuração"]

Ementa:
${syllabus}
  `;

  try {
    const text = await callWithFallback(prompt, apiKey, 0.2, signal);
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const lessons = JSON.parse(cleanText);
    if (!Array.isArray(lessons)) throw new Error('Retorno não é um array');
    return lessons;
  } catch (err) {
    console.error("Erro no parse/chamada da IA", err);
    throw new Error('A IA falhou ou não retornou um formato válido. Tente novamente.');
  }
}

export async function smartScheduleCourseWithGemini(apiKey: string, syllabus: string, existingRoutines: any[], today: Date, signal?: AbortSignal, preferences?: CoursePreferences): Promise<{ lesson: string, date: string, time: string, endTime: string }[]> {
  const compactRoutines = existingRoutines
    .filter(r => r.date && r.time) // Apenas rotinas com data e hora
    .map(r => ({ date: r.date, time: r.time, endTime: r.endTime, title: r.title }));

  const todayStr = today.toISOString().split('T')[0];

  const preferencesBlock = preferences
    ? buildPreferencesPrompt(preferences)
    : `
Preferências padrão:
- Distribua as aulas regularmente, máximo de 2 aulas por dia.
- Intervalo mínimo de 15 minutos entre aulas no mesmo dia.
- Distribua nos melhores horários livres.
`;

  const prompt = `
Você é um assistente pessoal inteligente de organização de estudos.
Sua missão é extrair as aulas da ementa de um curso e agendá-las no calendário do usuário.

Ementa do curso:
${syllabus}

Tarefas já agendadas do usuário (não crie conflitos com estas):
${JSON.stringify(compactRoutines.slice(0, 100))}
${preferencesBlock}
Regras ABSOLUTAS (nunca viole):
1. Se a ementa fornecer a duração/tempo da aula, calcule o \`endTime\` exato adicionando essa duração ao \`time\`. Se não fornecer, assuma 1 hora por aula.
2. NUNCA agende aulas entre 22:00 e 07:00.
3. Não agende no mesmo horário de uma tarefa já existente.
4. Comece o agendamento a partir do dia de hoje (${todayStr}) ou amanhã.

Retorne APENAS um array JSON válido contendo as aulas agendadas. Sem formatação markdown, sem crases, apenas o JSON puro.
Formato exato de cada objeto no array:
{
  "lesson": "Nome da aula extraída",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "endTime": "HH:MM"
}
`;

  try {
    const text = await callWithFallback(prompt, apiKey, 0.1, signal);
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const scheduledLessons = JSON.parse(cleanText);
    if (!Array.isArray(scheduledLessons)) throw new Error('Retorno não é um array');
    return scheduledLessons;
  } catch (err) {
    console.error("Erro no parse/chamada da IA", err);
    throw new Error('A IA falhou em gerar o agendamento. Tente novamente.');
  }
}
