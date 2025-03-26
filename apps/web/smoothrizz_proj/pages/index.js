// apps/web/pages/index.js
import { useState } from 'react';

export default function Home() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const callOpenAI = async () => {
    setLoading(true);
    try {
      // NEXT_PUBLIC_API_URL should be set in your Vercel environment variables
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Adjust the payload to match your API's requirements:
        body: JSON.stringify({
          context: 'Test conversation context',
          lastText: 'Last message here',
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error('Error calling API:', error);
      setResult({ error: 'Failed to fetch' });
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Test OpenAI API Endpoint</h1>
      <button onClick={callOpenAI} disabled={loading}>
        {loading ? 'Loading...' : 'Call API'}
      </button>
      {result && (
        <pre
          style={{
            marginTop: '1rem',
            background: '#f0f0f0',
            padding: '1rem',
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
