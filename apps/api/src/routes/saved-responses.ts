import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const userEmail = req.headers['x-user-email'] as string;

    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('users')
      .select('saved_responses')
      .eq('email', userEmail)
      .single();

    if (error) throw error;

    res.json({ responses: data?.saved_responses || [] });
  } catch (error: any) {
    console.error('Error fetching saved responses:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const userEmail = req.headers['x-user-email'] as string;
    const { response, context, lastMessage } = req.body;

    if (!userEmail) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get current saved responses
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('saved_responses')
      .eq('email', userEmail)
      .single();

    if (fetchError) throw fetchError;

    // Prepare new response
    const newResponse = {
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

    if (updateError) throw updateError;

    res.json({ success: true, response: newResponse });
  } catch (error: any) {
    console.error('Error saving response:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

router.delete('/', async (req: Request, res: Response) => {
  try {
    const userEmail = req.headers['x-user-email'] as string;
    const timestamp = req.query.timestamp as string;

    if (!userEmail || !timestamp) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Get current saved responses
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('saved_responses')
      .eq('email', userEmail)
      .single();

    if (fetchError) throw fetchError;

    // Filter out the response to delete
    const currentResponses = userData?.saved_responses || [];
    const updatedResponses = currentResponses.filter(
      (r: any) => r.created_at !== timestamp
    );

    // Update user's saved responses
    const { error: updateError } = await supabase
      .from('users')
      .update({ saved_responses: updatedResponses })
      .eq('email', userEmail);

    if (updateError) throw updateError;

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting response:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router; 