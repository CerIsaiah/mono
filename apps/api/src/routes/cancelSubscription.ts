import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Interfaces
interface CancelSubscriptionBody {
    userEmail?: string;
    userId?: string;
}

interface UserData {
    id: string;
    email: string;
    stripe_customer_id?: string;
    is_trial?: boolean;
    trial_end_date?: string;
}

// Service class for subscription management
class SubscriptionService {
    private stripe: Stripe | null;
    private supabase: any;
    private logger: Logger;

    constructor(stripe: Stripe | null, supabase: any) {
        this.stripe = stripe;
        this.supabase = supabase;
        this.logger = new Logger('SubscriptionService');
    }

    async cancelTrialSubscription(user: UserData) {
        this.logger.debug('Cancelling trial subscription', { userId: user.id });
        
        const { data: updatedUser, error: updateError } = await this.supabase
            .from('users')
            .update({
                is_trial: false,
                trial_end_date: null,
                subscription_status: 'inactive',
                subscription_type: 'standard',
                canceled_during_trial: true,
                cancellation_date: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single();

        if (updateError) {
            this.logger.error('Failed to cancel trial subscription', { error: updateError, userId: user.id });
            throw new Error('Failed to cancel trial subscription');
        }

        this.logger.info('Successfully cancelled trial subscription', { userId: user.id });
        return updatedUser;
    }

    async cancelStripeSubscription(user: UserData) {
        if (!this.stripe) {
            throw new Error('Stripe is not configured');
        }

        this.logger.debug('Fetching Stripe subscriptions', { customerId: user.stripe_customer_id });
        
        const subscriptions = await this.stripe.subscriptions.list({
            customer: user.stripe_customer_id!,
            status: 'all',
            limit: 10,
        });

        const cancellableSubscriptions = subscriptions.data.filter(sub =>
            ['active', 'trialing'].includes(sub.status) && !sub.cancel_at_period_end
        );

        this.logger.info('Found cancellable subscriptions', { 
            count: cancellableSubscriptions.length,
            subscriptionIds: cancellableSubscriptions.map(s => s.id)
        });

        if (cancellableSubscriptions.length === 0) {
            const alreadyCancelingSub = subscriptions.data.find(sub => sub.cancel_at_period_end);
            if (alreadyCancelingSub) {
                return { status: 'already_canceling', subscription: alreadyCancelingSub };
            }
            throw new Error('No active subscription found to cancel');
        }

        const subscriptionToCancel = cancellableSubscriptions[0];
        
        this.logger.debug('Cancelling subscription', { 
            subscriptionId: subscriptionToCancel.id,
            userId: user.id 
        });

        const canceledSubscription = await this.stripe.subscriptions.update(subscriptionToCancel.id, {
            cancel_at_period_end: true,
        });

        await this.updateUserSubscriptionStatus(user, canceledSubscription);

        return { status: 'cancelled', subscription: canceledSubscription };
    }

    private async updateUserSubscriptionStatus(user: UserData, canceledSubscription: Stripe.Subscription) {
        const subscriptionEndDate = new Date(canceledSubscription.current_period_end * 1000).toISOString();
        
        const updateData = {
            cancel_at_period_end: true,
            subscription_end_date: subscriptionEndDate,
            subscription_updated_at: new Date().toISOString(),
            subscription_status: 'active',
            canceled_during_trial: canceledSubscription.status === 'trialing',
            cancellation_date: new Date().toISOString()
        };

        const { data: updatedUser, error: updateError } = await this.supabase
            .from('users')
            .update(updateData)
            .eq('id', user.id)
            .select()
            .single();

        if (updateError) {
            this.logger.error('Failed to update user subscription status', { 
                error: updateError,
                userId: user.id
            });
            throw new Error('Failed to update user subscription status');
        }

        return updatedUser;
    }
}

// Logger class for consistent logging
class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    debug(message: string, data?: any) {
        console.debug(`[${this.context}] ${message}`, data ? data : '');
    }

    info(message: string, data?: any) {
        console.info(`[${this.context}] ${message}`, data ? data : '');
    }

    warn(message: string, data?: any) {
        console.warn(`[${this.context}] ${message}`, data ? data : '');
    }

    error(message: string, data?: any) {
        console.error(`[${this.context}] ${message}`, data ? data : '');
    }
}

// Initialize services
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-02-24.acacia'
    });
}

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

const subscriptionService = new SubscriptionService(stripe, supabase);
const logger = new Logger('CancelSubscriptionRoute');

const router = Router();

router.post('/', async (req: Request<{}, {}, CancelSubscriptionBody>, res: Response) => {
    try {
        const { userEmail, userId } = req.body;
        const normalizedUserEmail = userEmail?.toLowerCase().trim();

        if (!normalizedUserEmail && !userId) {
            logger.error('No user identifier provided');
            return res.status(400).json({ error: 'User email or ID is required' });
        }

        logger.debug('Processing cancellation request', { userEmail: normalizedUserEmail, userId });

        const lookupCriteria = userId
            ? { column: 'id', value: userId, label: `user ID ${userId}` }
            : { column: 'email', value: normalizedUserEmail!, label: `email ${normalizedUserEmail}` };

        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, email, stripe_customer_id, is_trial, trial_end_date')
            .eq(lookupCriteria.column, lookupCriteria.value)
            .single();

        if (userError || !user) {
            logger.error('User lookup failed', { error: userError, criteria: lookupCriteria });
            const status = userError ? 500 : 404;
            const message = userError ? `Database error finding user ${lookupCriteria.label}` : `User not found for ${lookupCriteria.label}`;
            return res.status(status).json({ error: message });
        }

        logger.info('Found user', { userId: user.id, email: user.email });

        // Handle trial cancellation
        if (!user.stripe_customer_id && user.is_trial) {
            const updatedUser = await subscriptionService.cancelTrialSubscription(user);
            return res.json({
                status: 'success',
                message: 'Trial cancelled successfully.',
                databaseUpdate: updatedUser
            });
        }

        // Handle Stripe subscription cancellation
        if (!user.stripe_customer_id) {
            logger.warn('No subscription found', { userId: user.id });
            return res.status(404).json({ error: 'No active subscription or trial found to cancel' });
        }

        const result = await subscriptionService.cancelStripeSubscription(user);

        if (result.status === 'already_canceling') {
            return res.json({ 
                status: 'success', 
                message: 'Subscription is already set to cancel at period end.' 
            });
        }

        return res.json({
            status: 'success',
            message: 'Subscription will be canceled at the end of the current period.',
            subscriptionEndDate: new Date(result.subscription.current_period_end * 1000).toISOString(),
            stripeSubscription: {
                id: result.subscription.id,
                status: result.subscription.status,
                cancel_at_period_end: result.subscription.cancel_at_period_end,
                current_period_end: result.subscription.current_period_end
            }
        });

    } catch (error: any) {
        logger.error('Subscription cancellation failed', { 
            error: error.message,
            stack: error.stack
        });

        if (error.code === 'resource_missing') {
            return res.status(404).json({ error: 'Subscription not found in Stripe.' });
        }

        return res.status(500).json({
            error: 'Failed to cancel subscription',
            details: error.message
        });
    }
});

export default router; 