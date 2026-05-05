import 'dotenv/config';

async function getEmbedding(text) {
  const response = await fetch('https://api.mistral.ai/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: 'mistral-embed',
      input: text
    })
  });

  const data = await response.json();
  return data.data[0].embedding;
}

async function searchSimilar(question, topK = 3) {
  const vector = await getEmbedding(question);

  const response = await fetch(`${process.env.PINECONE_INDEX_HOST}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': process.env.PINECONE_API_KEY
    },
    body: JSON.stringify({
      vector,
      topK,
      includeMetadata: true
    })
  });

  const data = await response.json();

  return data.matches.map(m => ({
    score: m.score,
    metadata: m.metadata
  }));
}

const question = 'Qui a créé Node.js et quand ?';
console.log(`Question : ${question}\n`);

const results = await searchSimilar(question);

console.log('Résultats trouvés :');
results.forEach(r => {
  console.log(`Score: ${r.score.toFixed(3)} | ${r.metadata.text.slice(0, 100)}…`);
});

console.log('\n--- Test hors sujet ---');
const outOfScope = 'Quel est le cours de la bourse aujourd\'hui ?';
console.log(`Question : ${outOfScope}\n`);
const results2 = await searchSimilar(outOfScope);
console.log('Résultats trouvés :');
results2.forEach(r => {
  console.log(`Score: ${r.score.toFixed(3)} | ${r.metadata.text.slice(0, 100)}…`);
});
