import 'dotenv/config';

const SAMPLE_DOCUMENT = `
Node.js est un environnement d'exécution JavaScript côté serveur, créé par Ryan Dahl en 2009.
Il utilise le moteur V8 de Google Chrome pour exécuter du JavaScript hors du navigateur.
Node.js est particulièrement performant pour les applications I/O-intensives grâce à son modèle non-bloquant.
npm est le gestionnaire de paquets officiel de Node.js, avec plus d'un million de packages disponibles.
Node.js utilise un modèle événementiel single-thread qui lui permet de gérer des milliers de connexions simultanées.
Express.js est le framework web le plus populaire pour Node.js, minimaliste et très bien documenté.
Les modules ES (import/export) sont supportés nativement dans Node.js depuis la version 12.
Node.js est maintenu par la OpenJS Foundation et bénéficie d'une large communauté open source.
`;

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

function simpleChunk(text, maxWords = 50) {
  const sentences = text
    .split(/[.\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 10);

  const chunks = [];
  let current = [];

  for (const sentence of sentences) {
    current.push(sentence);
    const wordCount = current.join(' ').split(/\s+/).length;
    if (wordCount >= maxWords) {
      chunks.push(current.join('. '));
      current = [];
    }
  }

  if (current.length > 0) {
    chunks.push(current.join('. '));
  }

  return chunks;
}

async function upsertChunks(chunks) {
  const vectors = await Promise.all(
    chunks.map(async (chunk, i) => {
      const embedding = await getEmbedding(chunk);
      return {
        id: `chunk-${i}`,
        values: embedding,
        metadata: { text: chunk }
      };
    })
  );

  const response = await fetch(`${process.env.PINECONE_INDEX_HOST}/vectors/upsert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Api-Key': process.env.PINECONE_API_KEY
    },
    body: JSON.stringify({ vectors })
  });

  const data = await response.json();
  return { upsertedCount: data.upsertedCount };
}

const chunks = simpleChunk(SAMPLE_DOCUMENT);
console.log(`Document découpé en ${chunks.length} chunks :`);
chunks.forEach((c, i) => console.log(`  [${i}] ${c.slice(0, 80)}…`));

console.log('\nGénération des embeddings et upsert dans Pinecone...');
const result = await upsertChunks(chunks);
console.log(`Upsert terminé :`, result);
