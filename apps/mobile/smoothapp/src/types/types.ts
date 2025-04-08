
// Types
export interface OpenAIResponse {
    responses: string[];
    requestId: string;
  }
  
  export interface OpenAIRequest {
    context?: string;
    lastText?: string;
    spicyLevel?: number;
    firstMoveIdeas?: string;
    imageBase64?: string;
  }
  