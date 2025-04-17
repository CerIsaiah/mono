import axios from 'axios';
import { OpenAIRequest, OpenAIResponse } from '../types/types';
const API_URL = 'https://mono-production-8ef9.up.railway.app';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

export const getOpenAIResponses = async (data: OpenAIRequest): Promise<OpenAIResponse> => {
  try {
    const response = await api.post('/api/openai', data);
    return response.data as OpenAIResponse;
  } catch (error: any) {
    const errorMessage = error?.response?.data?.error || error?.message || 'Failed to get responses';
    throw new Error(errorMessage);
  }
}; 