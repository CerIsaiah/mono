'use client';

import { useState } from 'react';

export default function Home() {
    console.log('Base URL:', process.env.NEXT_PUBLIC_BASE_URL);

  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState([]);
  const [error, setError] = useState('');
  const [inputType, setInputType] = useState('text'); // 'text' or 'image'
  
  // Form states
  const [context, setContext] = useState('');
  const [lastText, setLastText] = useState('');
  const [image, setImage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      let requestBody = {};
      
      if (inputType === 'text') {
        requestBody = {
          context,
          lastText,
          mode: 'first-move'
        };
      } else {
        // Convert image to base64
        const reader = new FileReader();
        reader.readAsDataURL(image);
        
        reader.onload = async () => {
          const base64Image = reader.result.split(',')[1];
          requestBody = {
            imageBase64: base64Image,
            mode: 'first-move'
          };
        };
      }

      // Use the full URL without the /api prefix since it's already in your Express route
      const response = await fetch(`https://${process.env.NEXT_PUBLIC_BASE_URL}/api/openai`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get responses');
      }

      setResponses(data.responses);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-8">Smoothrizz Response Generator</h1>
      
      <div className="mb-4">
        <label className="mr-4">
          <input
            type="radio"
            value="text"
            checked={inputType === 'text'}
            onChange={(e) => setInputType(e.target.value)}
            className="mr-2"
          />
          Text Input
        </label>
        <label>
          <input
            type="radio"
            value="image"
            checked={inputType === 'image'}
            onChange={(e) => setInputType(e.target.value)}
            className="mr-2"
          />
          Image Input
        </label>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
        {inputType === 'text' ? (
          <>
            <div>
              <label className="block mb-2">Conversation Context:</label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="w-full p-2 border rounded"
                rows="4"
              />
            </div>
            <div>
              <label className="block mb-2">Last Message:</label>
              <input
                type="text"
                value={lastText}
                onChange={(e) => setLastText(e.target.value)}
                className="w-full p-2 border rounded"
              />
            </div>
          </>
        ) : (
          <div>
            <label className="block mb-2">Upload Image:</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files[0])}
              className="w-full"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {loading ? 'Generating...' : 'Generate Responses'}
        </button>
      </form>

      {error && (
        <div className="text-red-500 mt-4">{error}</div>
      )}

      {responses.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4">Generated Responses:</h2>
          <ul className="space-y-2">
            {responses.map((response, index) => (
              <li
                key={index}
                className="p-3 bg-gray-100 rounded"
              >
                {response}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}