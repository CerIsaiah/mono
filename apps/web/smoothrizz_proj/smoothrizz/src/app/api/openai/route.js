/**
 * OpenAI API Route
 * 
 * This file handles communication with OpenAI for generating responses.
 * 
 * Main Features:
 * - Processes image and text inputs
 * - Generates response suggestions
 * - Enforces usage limits
 * - Handles rate limiting
 * 
 * Dependencies:
 * - openai: For API communication
 * - @/utils/usageTracking: For checking usage limits
 * 
 * Side Effects:
 * - Makes external API calls to OpenAI
 * - Logs request data for debugging
 * 
 * Connected Files:
 * - src/app/openai.js: Client-side OpenAI utilities
 * - src/app/responses/page.js: Uses generated responses
 * - src/utils/usageTracking.js: Usage limit checks
 */

import OpenAI from "openai";
import { NextResponse } from 'next/server';
import { checkUsageStatus } from '@/utils/usageTracking';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
});

// System prompts stored securely on server
const SYSTEM_PROMPTS = {
  'first-move': `"""
Return EXACTLY 10 responses of the following styles and format for flirty but not too forward conversation continuation following these requirements:
INSTRUCTIONS###
1. ANALYZE CONTEXT:
   - IMPORTANT! You are responding as the person on the right side of the conversation
   - Read FULL conversation history
   - Identify consistent tone between the you as the responder and the person on the left (playful/serious/flirty)
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
   - 5 different styles 2 of each
   - Return as array of strings
   - [[...], [...],  [...],  [...],  [...],  [...],  [...],  [...],[...],[...] ]
   - Avoid: forced continuations, aggression, dismissiveness

STRATEGY EXAMPLES###
My input: "Thanks daddy" → Their input: "I'm your daddy?"
Acceptable Responses:
["Ig we'll see after the dinner", "Or I can take on the role, if you want", [...],  [...],  [...],  [...],  [...],  [...],  [...], "Hmm, you'll have to earn that title", ]


OUTPUT TEMPLATE###
Return exactly 10 responses in an array format suitable for JSON parsing.


""" 
`}

export async function POST(request) {
  try {
    const requestIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const userEmail = request.headers.get('x-user-email');
    
    // Check if we have a valid email, otherwise use IP
    const identifier = userEmail || requestIP;
    const isEmail = Boolean(userEmail && userEmail.includes('@'));
    
    // Check usage status
    const usageStatus = await checkUsageStatus(identifier, isEmail);

    if (usageStatus.limitReached) {
      return NextResponse.json({ 
        error: userEmail ? 
          'Daily limit reached. Please upgrade to continue.' : 
          'Anonymous usage limit reached. Please sign in to continue.',
        requestId: crypto.randomUUID()
      }, { status: 403 });
    }

    const { imageBase64, mode = 'first-move', context, lastText } = await request.json();
    
    console.log('Debug - OpenAI Request:', {
      ip: requestIP,
      isSignedIn: !!userEmail,
      timestamp: new Date().toISOString()
    });

    // Prepare the user message based on input type
    let userMessage;

    if (imageBase64) {
      userMessage = [
        {
          type: "text",
          text: `What should I say back?`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${imageBase64}`
          }
        }
      ];
    } else if (context && lastText) {
      userMessage = [
        {
          type: "text",
          text: `Context of conversation: ${context}\n\nLast message from them: ${lastText}\n\nWhat should I say back?`
        }
      ];
    }

    // Add input validation
    if (!imageBase64 && (!context || !lastText)) {
      return NextResponse.json({ 
        error: 'Please provide either an image or conversation details',
        requestId: crypto.randomUUID()
      }, { status: 400 });
    }

    // Also validate that we don't receive both inputs
    if (imageBase64 && (context || lastText)) {
      return NextResponse.json({ 
        error: 'Please provide either an image or conversation details, not both',
        requestId: crypto.randomUUID()
      }, { status: 400 });
    }

    const response = await openai.chat.completions.create({
      model: "ft:gpt-4o-2024-08-06:personal:usepickup-6:B6vmJdwR:ckpt-step-56",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPTS['first-move']
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "responses_format",
          schema: {
            type: "object",
            properties: {
              responses: {
                type: "array",
                items: {
                  type: "string"
                },
              }
            },
            required: ["responses"],
            additionalProperties: false
          },
          strict: true
        }
      }
    });

    const message = response.choices[0].message;

    // Check for refusal
    if (message.refusal) {
      throw new Error(`Model refused to generate response: ${message.refusal}`);
    }

    // Parse and validate responses
    const parsedResponses = JSON.parse(message.content).responses;
    
    if (!Array.isArray(parsedResponses) || parsedResponses.length !== 10) {
      throw new Error(`Invalid number of responses: Expected 10, got ${parsedResponses.length}`);
    }

    return NextResponse.json({
      responses: parsedResponses,
      requestId: crypto.randomUUID()
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ 
      error: error.message,
      requestId: crypto.randomUUID()
    }, { status: 500 });
  }
} 