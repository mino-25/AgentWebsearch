import 'dotenv/config';

async function getIndexInfo() {
  const response = await fetch(
    `https://api.pinecone.io/indexes/${process.env.PINECONE_INDEX_NAME}`,
    {
      headers: {
        'Api-Key': process.env.PINECONE_API_KEY
      }
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur Pinecone : ${response.status} — ${err}`);
  }

  const data = await response.json();

  return {
    name: data.name,
    dimension: data.dimension,
    metric: data.metric,
    status: data.status?.state,
    host: data.host
  };
}

const info = await getIndexInfo();
console.log('Index connecté :', info);
