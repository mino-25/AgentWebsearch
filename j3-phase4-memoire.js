import 'dotenv/config';
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

const calculateTool = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Évalue une expression mathématique et retourne le résultat numérique. À utiliser pour tout calcul arithmétique.',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: "L'expression à évaluer, ex: '(15 * 4) / 3'" }
      },
      required: ['expression']
    }
  }
};

const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Récupère la météo actuelle pour une ville donnée. Utiliser quand on parle de météo, température, conditions climatiques.',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string', description: "Le nom de la ville en anglais (ex: 'Paris', 'London')" }
      },
      required: ['city']
    }
  }
};

const searchTool = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Recherche des informations récentes sur le web. Utiliser pour des faits actuels, des événements récents, ou quand on n\'est pas certain d\'une information.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'La requête de recherche, en anglais pour de meilleurs résultats' }
      },
      required: ['query']
    }
  }
};

function calculate({ expression }) {
  const safe = /^[\d\s\+\-\*\/\.\(\)\^%\*\*]+$/.test(expression);
  if (!safe) throw new Error(`Expression non autorisée : ${expression}`);
  return { result: Function('"use strict"; return (' + expression + ')')() };
}

async function get_weather({ city }) {
  const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
  if (!response.ok) return { error: `Impossible de récupérer la météo pour ${city}` };
  const data = await response.json();
  const current = data.current_condition[0];
  return {
    city,
    temperature_c: current.temp_C,
    feels_like_c: current.FeelsLikeC,
    description: current.weatherDesc[0].value,
    humidity: current.humidity + '%',
    wind_kmph: current.windspeedKmph
  };
}

async function web_search({ query }) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (educational project)' }
  });
  const data = await response.json();

  const results = data.RelatedTopics
    .filter(t => t.Text)
    .slice(0, 5)
    .map(t => ({ text: t.Text, url: t.FirstURL }));

  if (results.length === 0 && data.AbstractText) {
    return [{ text: data.AbstractText, url: data.AbstractURL }];
  }

  return results.length > 0 ? results : { message: 'Aucun résultat trouvé.' };
}

const tools = [calculateTool, weatherTool, searchTool];
const toolFunctions = { calculate, get_weather, web_search };

const conversationHistory = [
  {
    role: 'system',
    content: 'Tu es un assistant qui répond en citant ses sources. Quand tu utilises des résultats de recherche web, mentionne les URLs. Si tu réponds de mémoire sans outil, dis-le explicitement.'
  }
];

async function chatWithAgent(userMessage) {
  conversationHistory.push({ role: 'user', content: userMessage });

  let iterations = 0;

  while (iterations < 10) {
    iterations++;

    const callStart = Date.now();
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: conversationHistory,
        tools,
        tool_choice: 'auto'
      })
    });

    const data = await response.json();
    const choice = data.choices[0];

    console.log(`  [Agent] Tour ${iterations} — ${data.usage?.total_tokens ?? '?'} tokens, ${Date.now() - callStart}ms`);

    conversationHistory.push(choice.message);

    if (choice.finish_reason === 'stop') {
      return choice.message.content;
    }

    if (choice.finish_reason === 'tool_calls') {
      const toolResults = await Promise.all(
        choice.message.tool_calls.map(async (toolCall) => {
          const fn = toolFunctions[toolCall.function.name];
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`  [Tool] ${toolCall.function.name}(${JSON.stringify(args)})`);
          const result = await fn(args);
          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          };
        })
      );
      conversationHistory.push(...toolResults);
    }
  }

  return 'Limite d\'itérations atteinte.';
}

console.log('Agent multi-outils avec mémoire. (Ctrl+C pour quitter)\n');

while (true) {
  const input = await question('Vous : ');
  if (!input.trim()) continue;

  const answer = await chatWithAgent(input);
  console.log(`Agent : ${answer}\n`);
}
