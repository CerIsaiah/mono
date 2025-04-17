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

    // Make the call to OpenAI
    const response = await openai.chat.completions.create({
      model: 'ft:gpt-4o-2024-08-06:personal:usepickup-6:B6vmJdwR:ckpt-step-56',
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPTS['first-move'],
        },
        ...userMessage, // Spread the user message(s) here
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'responses_format',
          schema: {
            type: 'object',
            properties: {
              responses: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
            required: ['responses'],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    });

    const message = response.choices[0].message;

    // Check for refusal
    if (message.refusal) {
      throw new Error(
        `Model refused to generate response: ${message.refusal}`
      );
    }

    if (!message.content) {
      throw new Error('No content received from OpenAI');
    }

    let parsedResponses;
    try {
      parsedResponses = JSON.parse(message.content).responses;
    } catch (parseError: any) {
      logger.error('Failed to parse OpenAI JSON response', { content: message.content, error: parseError.message, requestId });
      throw new Error(`Failed to parse response from AI: ${parseError.message}`);
    }

    if (!Array.isArray(parsedResponses) || parsedResponses.length !== 10) {
      logger.warn('Invalid number/format of responses received', { count: parsedResponses?.length, requestId });
      throw new Error(
        `Invalid response format: Expected an array of 10 strings, received differently.`
      );
    }

    return res.json({
      responses: parsedResponses,
      requestId,
    });
  } catch (error: any) {
    logger.error('OpenAI API error (/openai route)', {
      error: error.message,
      stack: error.stack,
      requestId,
    });
    // Ensure a consistent error response structure
    const errorMessage = error.message || 'An internal server error occurred';
    const statusCode = error.response?.status || 500; // Use status from OpenAI error if available
    return res.status(statusCode).json({
      error: errorMessage,
      requestId,
    });
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
    return res.status(500).json({ error: error.message, requestId });
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
    return res.status(500).json({ error: 'An internal server error occurred while processing images.', requestId });
  }
});

export default router;
