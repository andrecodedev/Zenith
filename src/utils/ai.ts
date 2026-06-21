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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        }
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Gemini API Error:", response.status, errorBody);
    throw new Error(`Falha na API (Status ${response.status}). Verifique sua chave ou olhe o Console (F12).`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  
  try {
    // Tentar limpar caso a IA retorne com crases
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const lessons = JSON.parse(cleanText);
    if (!Array.isArray(lessons)) throw new Error('Retorno não é um array');
    return lessons;
  } catch (err) {
    console.error("Erro no parse do JSON da IA", text);
    throw new Error('A IA não retornou um formato válido. Tente novamente.', { cause: err });
  }
}

export async function smartScheduleCourseWithGemini(apiKey: string, syllabus: string, existingRoutines: any[], today: Date, signal?: AbortSignal): Promise<{ lesson: string, date: string, time: string, endTime: string }[]> {
  const compactRoutines = existingRoutines
    .filter(r => r.date && r.time) // Apenas rotinas com data e hora
    .map(r => ({ date: r.date, time: r.time, endTime: r.endTime, title: r.title }));

  const todayStr = today.toISOString().split('T')[0];

  const prompt = `
Você é um assistente pessoal inteligente de organização de estudos.
Sua missão é extrair as aulas da ementa de um curso e agendá-las no calendário do usuário.

Ementa do curso:
${syllabus}

Tarefas já agendadas do usuário (não crie conflitos com estas):
${JSON.stringify(compactRoutines.slice(0, 100))}

Regras INEGOCIÁVEIS de agendamento:
1. Se a ementa fornecer a duração/tempo da aula, calcule o \`endTime\` exato da aula adicionando essa duração ao \`time\`. Se não fornecer, assuma que cada aula dura em média 1 hora.
2. Agende no máximo 2 aulas por dia.
3. Respeite o descanso humano: NUNCA agende aulas entre 22:00 e 08:00.
4. Dias de semana (Seg-Sex): Tente agendar preferencialmente após as 18:00.
5. Finais de semana (Sáb-Dom): Tente agendar pela manhã (09:00 - 12:00).
6. Não agende no mesmo horário de uma tarefa já existente.
7. Comece o agendamento a partir do dia de hoje (${todayStr}) ou amanhã.

Retorne APENAS um array JSON válido contendo as aulas agendadas. Sem formatação markdown, sem crases, apenas o JSON puro.
Formato exato de cada objeto no array:
{
  "lesson": "Nome da aula extraída",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "endTime": "HH:MM"
}
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Falha na API Gemini (Status ${response.status}).`);
  }

  const data = await response.json();
  const text = data.candidates[0].content.parts[0].text;
  
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const scheduledLessons = JSON.parse(cleanText);
    if (!Array.isArray(scheduledLessons)) throw new Error('Retorno não é um array');
    return scheduledLessons;
  } catch (err) {
    console.error("Erro no parse do JSON da IA", text);
    throw new Error('A IA falhou em gerar o agendamento. Tente novamente.');
  }
}
