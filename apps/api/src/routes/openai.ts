// src/routes/openai.ts
import { Router } from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { logger } from '../utils/logger';

dotenv.config();

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// System prompts stored securely on the server
const SYSTEM_PROMPTS = {
  'first-move': `"""
Return EXACTLY 10 responses for flirty conversation continuation following these requirements:

INSTRUCTIONS###
1. CONTEXT PROCESSING:
   - You're the right-side participant
   - Analyze FULL conversation history for:
     * Established tone patterns (playful/serious/flirty ratio)
     * Single-mention moments (never reuse as patterns)
     * Relationship progression markers
     * Cultural/situational references from chat
   - Response must contain AT LEAST ONE:
     ✓ Situation-relevant humor
     ✓ Shared experience reference
     ✓ Inside joke foundation
     ✓ Focus on most recent conversational point
     ✓ Niche reference matching user's interests

2. SPICE INTERPRETATION:
   Spiciness Level → Behavior Guide:
   67-100: Confident humor > Suggestive wordplay > Contextual innuendo
   34-66: Playful teasing > Light challenges > Friendly banter
   0-33: Supportive curiosity > Neutral engagement > Earnest questions

3. STYLE REQUIREMENTS:
   AVAILABLE TECHNIQUES (use 5 styles, 2 each):
   - Situational sarcasm
   - Context callback
   - Nuanced challenge
   - Playful deflection
   - Earnest curiosity
   - Light self-deprecation
   - Clever misdirection
   - Cultural riff
   - Progressive escalation
   - Reality anchoring

4. RESPONSE CRITERIA:
   - 7-12 words per response
   - MAX 2 roleplay-style responses
   - NO consecutive same-style responses
   - 1:1 question-to-statement ratio
   - Modern natural speech patterns:
     1. Situational wit ("Says the double-text champion")
     2. Deflective humor ("Asking for a friend?")
     3. Callback integration ("Like your green jacket era?")
     4. Light challenge ("Prove it's not just talk")
     5. Earnest follow-up ("But really, how's your day?")
   - STRICT PROHIBITIONS:
     × Overused pickup lines
     × Generic pet names (babe/daddy)
     × Unearned intimacy
     × Transactional phrasing
     × Pop culture references >5 years old

5. CONVERSATION PHYSICS:
   - Escalation pacing: Flirt (2) → Relate (1) → Challenge (1) → Reset (1)
   - Every 3rd response max can be pure tease
   - Mandatory 3-second rule: "Would this make someone pause awkwardly?"
   - Natural response curve:
     High energy → Medium → Low → Medium → High

6. FORMAT REQUIREMENTS:
   - EXACTLY 10 responses
   - No emojis
   - 5 different styles, 2 of each
   - Return as array of strings
   - [[...], [...],  [...],  [...],  [...],  [...],  [...],  [...], [...], [...]]
   - Avoid: forced continuations, aggression, dismissiveness

STRATEGY EXAMPLES###
User: "Buy me a drink"
Improved Responses: [
  "Drinks on me if you beat me at pool",
  "The good stuff's where the good convos are",
  "Bold ask from someone who hates IPAs",
]
OUTPUT TEMPLATE###
Return array with exactly 10 responses following all above rules JSON PARSEABLE
"""`,
// UPDATED SYSTEM PROMPT FOR CHAT ANALYSIS
'chat-analysis': `"""
Analyze the provided chat screenshot from a dating app conversation. You are the participant whose messages appear on the RIGHT side. Rate EACH RIGHT-SIDE message based on the specified conversation context ('first_move', 'mid_game', 'end_game').

INSTRUCTIONS###
1.  **Identify Right-Side Messages:** Extract text from ALL messages sent by the user on the right.
2.  **Contextual Rating:** For each right-side message, provide a VERY concise, qualitative rating (MAX 4 words). Evaluate effectiveness based on the conversation 'context':
    *   **'first_move':** Focus on initiating interest, avoiding generics. (e.g., "Good hook!", "Too bland", "Engaging question", "Ask more")
    *   **'mid_game':** Focus on flow, connection, humor, personality. (e.g., "Keeps it flowing", "Bit dry", "Nice callback!", "Show more you")
    *   **'end_game':** Focus on suggesting meetup, transition, clarity. (e.g., "Clear next step", "A little vague", "Confident ask", "Smooth transition")
3.  **Rating Style:** Be direct, encouraging, and extremely brief. Use fun, catchy phrases. Examples: "Solid gold!", "Needs more spice!", "Great vibe check", "Perfectly playful", "Kinda generic...", "Ooo bold move!", "Ask something back", "Nice follow-up".
4.  **Output Format:** Return a JSON object containing a single key "analysis", which holds an array of objects. Each object must have two keys: 'message' (the exact right-side message text) and 'rating' (your max 4-word rating). Preserve message order.

EXAMPLE OUTPUT (for 'mid_game' context)###
{
  "analysis": [
    { "message": "Haha yeah that movie was wild", "rating": "Relatable, add question." },
    { "message": "What else did you do this weekend?", "rating": "Good open question!" },
    { "message": "Lol sounds fun!", "rating": "Bit passive, share more." }
  ]
}

RESTRICTIONS###
- Only analyze RIGHT-SIDE messages.
- Ratings ABSOLUTELY MAX 4 words.
- Output MUST be valid JSON: { "analysis": [ { "message": "...", "rating": "..." }, ... ] }
- If no right-side messages, return { "analysis": [] }.
"""`
};

// Helper function to validate base64 format
const isValidBase64 = (str: string): boolean => /^[A-Za-z0-9+/=]+$/.test(str);

// Helper function to perform a single image rating with OpenAI
async function rateSingleImage(imageBase64: string): Promise<string> {
  if (!isValidBase64(imageBase64)) {
    throw new Error('Invalid base64 format provided');
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      // Shortened prompt for brevity and focused rating
      content: `Rate the image for a dating profile (like Tinder) on a scale from 1 (worst) to 10 (best). Start your response with the numerical score (e.g., "8/10"). Provide a brief (10-15 word) explanation for the rating. Focus on aspects relevant to dating profiles (e.g., clarity, attractiveness, vibe, conversation starters).`
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Rate this image (1-10) for a dating profile and briefly explain.' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using mini for cost/speed efficiency
      messages: messages,
      max_tokens: 80, // Limit tokens for a brief response
      temperature: 0.5, // Lower temperature for more consistent rating format
    });

    const message = response.choices[0].message;
    const finishReason = response.choices[0].finish_reason;

    if (!message.content) {
      logger.warn('No content received from OpenAI for single image rating', { finish_reason: finishReason });
      throw new Error(`No content from AI. Reason: ${finishReason}`);
    }

    return message.content.trim();

  } catch (error: any) {
    logger.error('OpenAI API call failed during single image rating', { error: error.message, stack: error.stack });
    // Re-throw a more specific error or return a marker string
    throw new Error(`Failed to rate image: ${error.message}`);
  }
}

router.post('/openai', async (req, res) => {
  const requestId = crypto.randomUUID(); // Generate request ID early
  try {
    const requestIP =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
    const userEmail = req.headers['x-user-email'] as string | undefined;
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail && userEmail.includes('@'));

    // Check usage status
    //const usageStatus = await checkUsageStatus(identifier, isEmail);


    const { imageBase64, mode = 'first-move', context, lastText, spicyLevel = 50, firstMoveIdeas = '' } = req.body;

    logger.info('Debug - OpenAI Request:', {
      ip: requestIP,
      isSignedIn: !!userEmail,
      timestamp: new Date().toISOString(),
      spicyLevel,
      hasFirstMoveIdeas: !!firstMoveIdeas,
      mode,
      requestId,
    });

    let userMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    if (imageBase64) {
      // Validate base64 string
      if (!isValidBase64(imageBase64)) {
        return res.status(400).json({
          error: 'Invalid base64 format',
          requestId,
        });
      }

      userMessage = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `What should I say back? Use spiciness level ${spicyLevel}/100${firstMoveIdeas ? `. First move ideas (but dont have to use them) : ${firstMoveIdeas}` : ''}`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
              },
            },
          ],
        },
      ];
    } else if (context && lastText) {
      userMessage = [
        {
          role: 'user',
          content: `Context of conversation: ${context}\n\nLast message from them: ${lastText}\n\nWhat should I say back? Use spiciness level ${spicyLevel}/100${firstMoveIdeas ? `. First move ideas (but dont have to use them) : ${firstMoveIdeas}` : ''}`,
        },
      ];
    } else {
      // Validate input: must provide either image or conversation details.
      return res.status(400).json({
        error: 'Please provide either an image or conversation details (context and lastText)',
        requestId,
      });
    }

    // Select the appropriate system prompt based on mode
    const systemPromptContent = SYSTEM_PROMPTS[mode as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS['first-move'];

    // Make the call to OpenAI
    const response = await openai.chat.completions.create({
      // Use fine-tuned model if available and appropriate, otherwise fallback
      // model: 'ft:gpt-4o-2024-08-06:personal:usepickup-6:B6vmJdwR:ckpt-step-56',
       model: 'gpt-4o', // Using a powerful model for potentially complex prompt following
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPromptContent, // Use selected system prompt
        },
        ...userMessage, // Spread the user message(s) here
      ],
      response_format: {
        type: 'json_object', // Changed to json_object for the main endpoint
      },
    });

    const message = response.choices[0].message;
    const finishReason = response.choices[0].finish_reason;

    // Check for refusal
    if (message.refusal || finishReason === 'content_filter') {
      logger.warn('OpenAI request refused or filtered', { refusal: message.refusal, finish_reason: finishReason, requestId });
      throw new Error(
        `Model refused to generate response${message.refusal ? ': ' + message.refusal : ' due to content filter.'}`
      );
    }

    if (!message.content) {
       logger.warn('No content received from OpenAI', { finish_reason: finishReason, requestId });
      throw new Error(`No content from AI. Finish reason: ${finishReason}`);
    }

    let parsedResponses;
    try {
      // Attempt to parse assuming the structure { "responses": [...] }
      const parsedJson = JSON.parse(message.content);
      parsedResponses = parsedJson.responses;
      if (!parsedResponses) {
         throw new Error("Parsed JSON does not contain a 'responses' key.");
      }
    } catch (parseError: any) {
      logger.error('Failed to parse OpenAI JSON response', { content: message.content, error: parseError.message, requestId });
      // Attempt to handle cases where the AI might return just the array
      try {
        parsedResponses = JSON.parse(`{"responses": ${message.content}}`).responses;
        logger.info('Successfully parsed response after wrapping in {"responses": ...}', { requestId });
      } catch (nestedError: any) {
        logger.error('Failed second attempt to parse OpenAI response', { content: message.content, error: nestedError.message, requestId });
        throw new Error(`Failed to parse response from AI: ${parseError.message}. Original content: ${message.content.substring(0, 100)}...`);
      }
    }

    // Validate the final parsed structure
    if (!Array.isArray(parsedResponses) || parsedResponses.some(item => typeof item !== 'string')) {
        logger.warn('Invalid format for parsed responses', { parsedResponses, requestId });
        throw new Error(
            `Invalid response format: Expected an array of strings in the 'responses' field.`
        );
    }

    // We expect 10 responses based on the prompt
    if (parsedResponses.length !== 10) {
      logger.warn('Unexpected number of responses received', { count: parsedResponses.length, expected: 10, requestId });
      // Decide whether to error out or proceed with what was received
      // For now, let's proceed but log a warning.
    }


    return res.json({
      responses: parsedResponses,
      requestId,
    });
  } catch (error: any) {
    logger.error('OpenAI API error (/openai route)', {
      error: error.message,
      stack: error.stack,
      requestId: requestId || 'unknown', // Ensure requestId is included if available
    });
    // Ensure a consistent error response structure
    const errorMessage = error.message || 'An internal server error occurred';
    const statusCode = error.response?.status || (error instanceof OpenAI.APIError ? error.status : 500); // Use status from OpenAI error if available
    return res.status(statusCode ?? 500).json({
      error: errorMessage,
      requestId: requestId || 'unknown', // Ensure requestId is included
    });
  }
});


// NEW Endpoint for Chat Analysis
router.post('/analyze-chat', async (req, res) => {
  const requestId = crypto.randomUUID();
  try {
    const { imageBase64, context: chatContext = 'mid_game' } = req.body; // Default context if not provided
    const userEmail = req.headers['x-user-email'] as string | undefined;

    logger.info('Received /analyze-chat request', { userEmail, context: chatContext, requestId });

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body', requestId });
    }
    if (!isValidBase64(imageBase64)) {
      return res.status(400).json({ error: 'Invalid base64 format', requestId });
    }

    // Ensure the provided context is valid, fallback to a default if not
    const validContexts = ['first_move', 'mid_game', 'end_game'];
    const systemPromptContext = validContexts.includes(chatContext) ? chatContext : 'mid_game';

    const systemPrompt = SYSTEM_PROMPTS['chat-analysis'];
    if (!systemPrompt) {
        throw new Error("Chat analysis system prompt is missing.");
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze the user's (right-side) messages in this chat screenshot using the '${systemPromptContext}' context.`
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${imageBase64}` }
          }
        ]
      }
    ];

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for this analysis task
      messages: messages,
      max_tokens: 500, // Allow sufficient tokens for analysis of multiple messages
      temperature: 0.4, // Slightly adjusted temperature for creative but concise ratings
      response_format: { type: "json_object" } // Expect JSON output as defined in prompt
    });

    const message = response.choices[0].message;
    const finishReason = response.choices[0].finish_reason;

    if (message.refusal || finishReason === 'content_filter') {
      logger.warn('OpenAI request refused or filtered for /analyze-chat', { refusal: message.refusal, finish_reason: finishReason, requestId });
      throw new Error(`Model refused analysis${message.refusal ? ': ' + message.refusal : ' due to content filter.'}`);
    }

    if (!message.content) {
      logger.warn('No content received from OpenAI for /analyze-chat', { finish_reason: finishReason, requestId });
      throw new Error(`No analysis content from AI. Finish reason: ${finishReason}`);
    }

    // Parse the JSON response
    let analysisResults;
    try {
      // The prompt asks for { "analysis": [...] }
       const parsedJson = JSON.parse(message.content);
       if (parsedJson.analysis && Array.isArray(parsedJson.analysis)) {
          analysisResults = parsedJson.analysis;
       } else {
         throw new Error('Parsed JSON response does not contain the expected "analysis" array.');
       }

    } catch (parseError: any) {
      logger.error('Failed to parse OpenAI JSON response for /analyze-chat', { content: message.content, error: parseError.message, requestId });
      throw new Error(`Failed to parse analysis from AI: ${parseError.message}. Content: ${message.content.substring(0,100)}...`);
    }

    // Validate the structure of the results
    if (!Array.isArray(analysisResults) || analysisResults.some((item: {message?: any, rating?: any}) => typeof item !== 'object' || !item.message || !item.rating || typeof item.rating !== 'string' || item.rating.split(' ').length > 4 )) {
      logger.warn('Invalid analysis format or rating length received', { results: analysisResults, requestId });
       // Even if format is valid, check rating length constraint
       const invalidRating = analysisResults.find((item: {message?: any, rating?: any}) => typeof item.rating !== 'string' || item.rating.split(' ').length > 4);
       if (invalidRating) {
           throw new Error(`Invalid analysis format: Rating "${invalidRating.rating}" exceeds 4 words.`);
       } else {
           throw new Error('Invalid analysis format: Expected an array of {message, rating (string, max 4 words)} objects.');
       }
    }

    logger.info(`Successfully generated chat analysis for ${analysisResults.length} messages`, { requestId });
    return res.json({ analysis: analysisResults, requestId });

  } catch (error: any) {
    logger.error('OpenAI API error (/analyze-chat route)', {
      error: error.message,
      stack: error.stack,
      requestId,
    });
    const errorMessage = error.message || 'An internal server error occurred during chat analysis';
    const statusCode = error instanceof OpenAI.APIError ? error.status : 500;
    return res.status(statusCode ?? 500).json({ error: errorMessage, requestId });
  }
});


// Endpoint to rate a single image (kept for potential other uses or testing)
router.post('/rate-image', async (req, res) => {
  const requestId = crypto.randomUUID();
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body', requestId });
    }

    const rating = await rateSingleImage(imageBase64); // Use the helper function

    return res.json({ rating, requestId });

  } catch (error: any) {
    logger.error('Image rating error (/rate-image route)', {
      error: error.message,
      stack: error.stack,
      requestId,
    });
    // Use consistent error handling
    const errorMessage = error.message || 'An internal server error occurred during image rating';
    const statusCode = error instanceof OpenAI.APIError ? error.status : 500;
    return res.status(statusCode ?? 500).json({ error: errorMessage, requestId });
  }
});

// New endpoint to rate multiple images
router.post('/rate-multiple-images', async (req, res) => {
  const requestId = crypto.randomUUID();
  try {
    const { imagesBase64 } = req.body;

    // Input validation
    if (!Array.isArray(imagesBase64)) {
      return res.status(400).json({ error: 'Expected an array of base64 strings in imagesBase64 field', requestId });
    }
    if (imagesBase64.length === 0) {
      return res.status(400).json({ error: 'Received empty array of images', requestId });
    }
    if (imagesBase64.length > 10) {
      logger.warn('Received more than 10 images, limiting to 10.', { count: imagesBase64.length, requestId });
      // Optionally, trim the array or return an error. Let's trim for now.
      // imagesBase64 = imagesBase64.slice(0, 10);
      // Or return error:
      return res.status(400).json({ error: 'Cannot rate more than 10 images at a time', requestId });
    }

    logger.info(`Received request to rate ${imagesBase64.length} images`, { requestId });

    // Use Promise.allSettled to handle individual failures gracefully
    const ratingPromises = imagesBase64.map((base64, index) =>
      rateSingleImage(base64)
        .catch(err => {
          // Log individual errors and return an error marker string
          logger.error(`Error rating image index ${index}`, { error: err.message, requestId });
          return `Error: Failed to rate image ${index + 1}`; // User-friendly error marker
        })
    );

    // allSettled ensures we get a result for every promise, even if some reject
    const results = await Promise.allSettled(ratingPromises);

    // Process results, extracting the rating string or error marker
    const ratings = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value; // This is the rating string or the error marker from the catch block
      } else {
        // This case should technically be caught by the .catch inside the map,
        // but handle it just in case of unexpected errors.
        logger.error(`Unexpected settlement failure for image index ${index}`, { reason: result.reason, requestId });
        return `Error: Processing failed for image ${index + 1}`;
      }
    });

    return res.json({ ratings, requestId });

  } catch (error: any) {
    // Catch broader errors (e.g., issues before Promise.allSettled)
    logger.error('Error in /rate-multiple-images handler', {
      error: error.message,
      stack: error.stack,
      requestId,
    });
     // Use consistent error handling
    const errorMessage = error.message || 'An internal server error occurred while processing multiple images.';
    const statusCode = error instanceof OpenAI.APIError ? error.status : 500;
    return res.status(statusCode ?? 500).json({ error: errorMessage, requestId });
  }
});

export default router;
