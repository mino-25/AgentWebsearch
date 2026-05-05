import 'dotenv/config';

const calculateTool = {
  type: 'function',
  function: {
    name: 'calculate',
    description: 'Évalue une expression mathématique et retourne le résultat numérique. À utiliser pour tout calcul arithmétique.',
    parameters: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: "L'expression à évaluer, ex: '(15 * 4) / 3' ou '2 ** 32'"
        }
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
        city: {
          type: 'string',
          description: "Le nom de la ville, en anglais de préférence (ex: 'Paris', 'London', 'Tokyo')"
        }
      },
      required: ['city']
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

async function runAgent(tools, toolFunctions, userMessage, messages = null) {
  if (!messages) {
    messages = [{ role: 'user', content: userMessage }];
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

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
        messages,
        tools,
        tool_choice: 'auto'
      })
    });

    const data = await response.json();
    const choice = data.choices[0];

    console.log(`[Agent] Tour ${iterations} — ${data.usage?.total_tokens ?? '?'} tokens, ${Date.now() - callStart}ms`);

    messages.push(choice.message);

    if (choice.finish_reason === 'stop') {
      return choice.message.content;
    }

    if (choice.finish_reason === 'tool_calls') {
      const toolResults = await Promise.all(
        choice.message.tool_calls.map(async (toolCall) => {
          const fn = toolFunctions[toolCall.function.name];
          const args = JSON.parse(toolCall.function.arguments);
          const result = await fn(args);
          return {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          };
        })
      );
      messages.push(...toolResults);
    }
  }

  return 'Limite d\'itérations atteinte.';
}

const tools = [calculateTool, weatherTool];
const toolFunctions = { calculate, get_weather };

const answer = await runAgent(tools, toolFunctions, 'Quelle est la météo à Londres, et si je convertis la température en Fahrenheit ?');
console.log('Réponse finale :', answer);
