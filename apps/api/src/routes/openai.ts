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

router.post('/openai', async (req, res) => {
  try {
    const requestIP =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] || 'unknown';
    const userEmail = req.headers['x-user-email'] as string | undefined;
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail && userEmail.includes('@'));

    // Check usage status
    //const usageStatus = await checkUsageStatus(identifier, isEmail);

    
    const { imageBase64, mode = 'first-move', context, lastText, spicyLevel = 50, firstMoveIdeas = '' } = req.body;

    console.log('Debug - OpenAI Request:', {
      ip: requestIP,
      isSignedIn: !!userEmail,
      timestamp: new Date().toISOString(),
      spicyLevel,
      hasFirstMoveIdeas: !!firstMoveIdeas,
    });

    let userMessage: any[] = [{
      type: 'text',
      text: `What should I say back? Use spiciness level ${spicyLevel}/100${firstMoveIdeas ? `. First move ideas (but dont have to use them): ${firstMoveIdeas}` : ''}`,
    }];

    if (imageBase64) {
      // Validate base64 string
      if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
        throw new Error('Invalid base64 format');
      }

      userMessage = [
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
      ];
    } else if (context && lastText) {
      userMessage = [
        {
          type: 'text',
          text: `Context of conversation: ${context}\n\nLast message from them: ${lastText}\n\nWhat should I say back? Use spiciness level ${spicyLevel}/100${firstMoveIdeas ? `. First move ideas (but dont have to use them) : ${firstMoveIdeas}` : ''}`,
        },
      ];
    }

    // Validate input: must provide either image or conversation details, not both.
    if (!imageBase64 && (!context || !lastText)) {
      return res.status(400).json({
        error: 'Please provide either an image or conversation details',
        requestId: crypto.randomUUID(),
      });
    }
    if (imageBase64 && (context || lastText)) {
      return res.status(400).json({
        error: 'Please provide either an image or conversation details, not both',
        requestId: crypto.randomUUID(),
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
        {
          role: 'user',
          content: userMessage,
        },
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

    const parsedResponses = JSON.parse(message.content).responses;

    if (!Array.isArray(parsedResponses) || parsedResponses.length !== 10) {
      throw new Error(
        `Invalid number of responses: Expected 10, got ${parsedResponses.length}`
      );
    }

    return res.json({
      responses: parsedResponses,
      requestId: crypto.randomUUID(),
    });
  } catch (error: any) {
    logger.error('OpenAI API error', {
      error: error.message,
      stack: error.stack,
      requestId: crypto.randomUUID()
    });
    return res.status(500).json({
      error: error.message,
      requestId: crypto.randomUUID(),
    });
  }
});

router.post('/rate-image', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }
    // Validate base64 format
    if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
      return res.status(400).json({ error: 'Invalid base64 format' });
    }

    const messages: any[] = [
      {
        role: 'system',
        content: 'You are a helpful assistant. Rate the following image on a scale from 1 (worst) to 10 (best) and give a brief explanation. For tinder'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Please rate this image on a scale from 1 to 10 and explain your rating briefly.' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
        ]
      }
    ];

    const response = await openai.chat.completions.create({
      model: 'o4-mini-2025-04-16',
      messages,
      temperature: 1,
    });

    // Log the full choice object for debugging
    logger.info('OpenAI Image Rating Choice:', { choice: response.choices[0], requestId: crypto.randomUUID() });

    const message = response.choices[0].message;
    if (!message.content) {
      // Include finish_reason in the error for better diagnosis
      const finishReason = response.choices[0].finish_reason;
      logger.error('No content received from OpenAI', { 
        finish_reason: finishReason,
        requestId: crypto.randomUUID()
      });
      throw new Error(`No content received from OpenAI. Finish reason: ${finishReason}`);
    }

    return res.json({ rating: message.content, requestId: crypto.randomUUID() });
  } catch (error: any) {
    logger.error('Image rating error', {
      error: error.message,
      stack: error.stack,
      requestId: crypto.randomUUID()
    });
    return res.status(500).json({ error: error.message, requestId: crypto.randomUUID() });
  }
});

export default router;
