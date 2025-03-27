import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { SavedResponse } from '../types/api';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined;

    // For unauthenticated users, return empty array instead of error
    if (!userEmail) {
      return res.json({ responses: [] });
    }

    const { data, error } = await supabase
      .from('users')
      .select('saved_responses')
      .eq('email', userEmail.toLowerCase().trim())
      .single();

    if (error) {
      console.error('Error fetching saved responses:', error);
      return res.json({ responses: [] });
    }

    res.json({ responses: data?.saved_responses || [] });
  } catch (error: any) {
    console.error('Error fetching saved responses:', error);
    // Return empty array instead of error for better UX
    res.json({ responses: [] });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined;
    const { response, context, lastMessage } = req.body;

    if (!userEmail) {
      return res.status(401).json({ 
        error: 'Authentication required to save responses',
        requiresAuth: true 
      });
    }

    // Get current saved responses
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('saved_responses')
      .eq('email', userEmail.toLowerCase().trim())
      .single();

    if (fetchError) {
      console.error('Error fetching user data:', fetchError);
      throw fetchError;
    }

    // Prepare new response
    const newResponse: SavedResponse = {
      response,
      context,
      lastMessage,
      created_at: new Date().toISOString()
    };

    // Add to existing responses or create new array
    const currentResponses = userData?.saved_responses || [];
    const updatedResponses = [newResponse, ...currentResponses];

    // Update user's saved responses
    const { error: updateError } = await supabase
      .from('users')
      .update({ saved_responses: updatedResponses })
      .eq('email', userEmail);

    if (updateError) {
      console.error('Error updating saved responses:', updateError);
      throw updateError;
    }

    res.json({ success: true, response: newResponse });
  } catch (error: any) {
    console.error('Error saving response:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to save response',
      requiresAuth: error.message?.includes('Authentication') 
    });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const userEmail = req.headers['x-user-email'] as string | undefined;
    const timestamp = req.query.timestamp as string;

    if (!userEmail) {
      return res.status(401).json({ 
        error: 'Authentication required to delete responses',
        requiresAuth: true 
      });
    }

    if (!timestamp) {
      return res.status(400).json({ error: 'Timestamp is required' });
    }

    // Get current saved responses
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('saved_responses')
      .eq('email', userEmail.toLowerCase().trim())
      .single();

    if (fetchError) {
      console.error('Error fetching user data:', fetchError);
      throw fetchError;
    }

    // Filter out the response to delete
    const currentResponses = userData?.saved_responses || [];
    const updatedResponses = currentResponses.filter(
      (r: SavedResponse) => r.created_at !== timestamp
    );

    // Update user's saved responses
    const { error: updateError } = await supabase
      .from('users')
      .update({ saved_responses: updatedResponses })
      .eq('email', userEmail);

    if (updateError) {
      console.error('Error updating saved responses:', updateError);
      throw updateError;
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting response:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to delete response',
      requiresAuth: error.message?.includes('Authentication') 
    });
  }
});

export default router; 