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
Return EXACTLY 10 responses of the following styles and format for flirty but not too forward conversation continuation following these requirements:
INSTRUCTIONS###
1. ANALYZE CONTEXT:
   - IMPORTANT! You are responding as the person on the right side of the conversation
   - Read FULL conversation history
   - Identify consistent tone between you as the responder and the person on the left (playful/serious/flirty)
   - Note SINGLE-USE references (treat single mentions as moments, not patterns)
   - Track relationship milestones (dates/complaints/intimacy levels)

2. AVAILABLE STYLES:
    - Enthusiastic + pivot
    - Conditional tease
    - Helpful tease
    - Direct ask
    - Absurd commitment
    - Travel pivot
    - Interest escalation
    - Fake urgency
    - Absurd availability
    - Roleplay
    - Role tease
    - Mock annoyance

3. RESPONSE CRITERIA:
   - 5-15 words per response
   - Maintain natural progression
   - Acknowledge context without over-repetition
   - Match established familiarity level
   - Prioritize: Playful > Creative > Forward > Neutral

2. FORMAT REQUIREMENTS:
   - EXACTLY 10 responses 
   - No emojis
   - 5 different styles, 2 of each
   - Return as array of strings
   - [[...], [...],  [...],  [...],  [...],  [...],  [...],  [...], [...], [...]]
   - Avoid: forced continuations, aggression, dismissiveness

STRATEGY EXAMPLES###
My input: "Thanks daddy" → Their input: "I'm your daddy?"
Acceptable Responses:
["Ig we'll see after the dinner", "Or I can take on the role, if you want", [...],  [...],  [...],  [...],  [...],  [...],  [...], "Hmm, you'll have to earn that title"]

OUTPUT TEMPLATE###
Return exactly 10 responses in an array format suitable for JSON parsing.
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

    
    const { imageBase64, mode = 'first-move', context, lastText } = req.body;

    console.log('Debug - OpenAI Request:', {
      ip: requestIP,
      isSignedIn: !!userEmail,
      timestamp: new Date().toISOString(),
    });

    let userMessage: any[] = [{
      type: 'text',
      text: 'What should I say back?',
    }];

    if (imageBase64) {
      // Validate base64 string
      if (!/^[A-Za-z0-9+/=]+$/.test(imageBase64)) {
        throw new Error('Invalid base64 format');
      }

      userMessage = [
        {
          type: 'text',
          text: 'What should I say back?',
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
          text: `Context of conversation: ${context}\n\nLast message from them: ${lastText}\n\nWhat should I say back?`,
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

export default router;
