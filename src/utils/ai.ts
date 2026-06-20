export async function parseCourseWithGemini(apiKey: string, syllabus: string): Promise<string[]> {
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        }
      }),
    }
  );

  if (!response.ok) {
    throw new Error('Falha ao comunicar com a API do Gemini. Verifique sua chave.');
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
