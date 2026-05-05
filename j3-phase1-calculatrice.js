import 'dotenv/config';

const tools = [
  {
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
  }
];

function calculate({ expression }) {
  const safe = /^[\d\s\+\-\*\/\.\(\)\^%\*\*]+$/.test(expression);
  if (!safe) throw new Error(`Expression non autorisée : ${expression}`);
  return { result: Function('"use strict"; return (' + expression + ')')() };
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
      for (const toolCall of choice.message.tool_calls) {
        const fn = toolFunctions[toolCall.function.name];
        const args = JSON.parse(toolCall.function.arguments);
        const result = await fn(args);
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }
    }
  }

  return 'Limite d\'itérations atteinte.';
}

const toolFunctions = { calculate };

const answer = await runAgent(tools, toolFunctions, '17 au carré, plus 4 à la puissance 5 ?');
console.log('Réponse finale :', answer);
