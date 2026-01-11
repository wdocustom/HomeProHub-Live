/**
 * HomeProHub Stripe Payment Service
 * Handles subscriptions and pay-per-bid payments
 *
 * Subscription Plans:
 * - Basic: $29/month - Up to 10 bids
 * - Pro: $79/month - Unlimited bids
 * - Premium: $149/month - Unlimited bids + priority placement
 * - Pay-per-bid: $7 per bid
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const PLANS = {
  basic: {
    name: 'Basic',
    price: 2900, // $29.00 in cents
    bids_per_month: 10,
    features: [
      'Up to 10 bids per month',
      'Job board access',
      'Message contractors',
      'Basic support'
    ]
  },
  pro: {
    name: 'Pro',
    price: 7900, // $79.00
    bids_per_month: -1, // unlimited
    features: [
      'Unlimited bids',
      'Job board access',
      'Message contractors',
      'Priority support',
      'Advanced analytics'
    ]
  },
  premium: {
    name: 'Premium',
    price: 14900, // $149.00
    bids_per_month: -1,
    features: [
      'Unlimited bids',
      'Priority placement',
      'Featured contractor badge',
      'Job board access',
      'Message contractors',
      'Dedicated support',
      'Advanced analytics'
    ]
  }
};

const PAY_PER_BID_PRICE = 700; // $7.00 per bid

/**
 * Create a Stripe customer
 */
async function createCustomer(email, name, metadata = {}) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        source: 'homeprohub',
        ...metadata
      }
    });

    console.log(`✓ Stripe customer created: ${customer.id} for ${email}`);
    return customer;
  } catch (error) {
    console.error('Error creating Stripe customer:', error.message);
    throw new Error(`Failed to create customer: ${error.message}`);
  }
}

/**
 * Create subscription for a customer
 */
async function createSubscription(customerId, planId, paymentMethodId) {
  if (!PLANS[planId]) {
    throw new Error(`Invalid plan: ${planId}`);
  }

  try {
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    // Create price if it doesn't exist
    const plan = PLANS[planId];
    let priceId;

    // Check if price already exists
    const prices = await stripe.prices.list({
      product: process.env.STRIPE_PRODUCT_ID || 'prod_homeprohub_subscriptions',
      active: true,
      type: 'recurring'
    });

    const existingPrice = prices.data.find(p =>
      p.unit_amount === plan.price &&
      p.recurring.interval === 'month' &&
      p.metadata.plan_id === planId
    );

    if (existingPrice) {
      priceId = existingPrice.id;
    } else {
      // Create new price
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: plan.price,
        recurring: {
          interval: 'month'
        },
        product: process.env.STRIPE_PRODUCT_ID || 'prod_homeprohub_subscriptions',
        metadata: {
          plan_id: planId,
          plan_name: plan.name
        }
      });
      priceId = price.id;
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        plan_id: planId,
        plan_name: plan.name,
        bids_per_month: plan.bids_per_month.toString()
      }
    });

    console.log(`✓ Subscription created: ${subscription.id} for customer ${customerId}`);
    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error.message);
    throw new Error(`Failed to create subscription: ${error.message}`);
  }
}

/**
 * Cancel subscription
 */
async function cancelSubscription(subscriptionId, immediately = false) {
  try {
    let subscription;

    if (immediately) {
      // Cancel immediately
      subscription = await stripe.subscriptions.cancel(subscriptionId);
    } else {
      // Cancel at period end
      subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }

    console.log(`✓ Subscription ${immediately ? 'cancelled' : 'scheduled for cancellation'}: ${subscriptionId}`);
    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error.message);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
}

/**
 * Update subscription plan
 */
async function updateSubscription(subscriptionId, newPlanId) {
  if (!PLANS[newPlanId]) {
    throw new Error(`Invalid plan: ${newPlanId}`);
  }

  try {
    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    // Get or create price for new plan
    const plan = PLANS[newPlanId];
    let priceId;

    const prices = await stripe.prices.list({
      product: process.env.STRIPE_PRODUCT_ID || 'prod_homeprohub_subscriptions',
      active: true,
      type: 'recurring'
    });

    const existingPrice = prices.data.find(p =>
      p.unit_amount === plan.price &&
      p.recurring.interval === 'month' &&
      p.metadata.plan_id === newPlanId
    );

    if (existingPrice) {
      priceId = existingPrice.id;
    } else {
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: plan.price,
        recurring: {
          interval: 'month'
        },
        product: process.env.STRIPE_PRODUCT_ID || 'prod_homeprohub_subscriptions',
        metadata: {
          plan_id: newPlanId,
          plan_name: plan.name
        }
      });
      priceId = price.id;
    }

    // Update subscription
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId
      }],
      proration_behavior: 'create_prorations',
      metadata: {
        plan_id: newPlanId,
        plan_name: plan.name,
        bids_per_month: plan.bids_per_month.toString()
      }
    });

    console.log(`✓ Subscription updated: ${subscriptionId} to ${newPlanId}`);
    return updatedSubscription;
  } catch (error) {
    console.error('Error updating subscription:', error.message);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
}

/**
 * Charge for single bid (pay-per-bid)
 */
async function chargeForBid(customerId, jobId, jobTitle) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: PAY_PER_BID_PRICE,
      currency: 'usd',
      customer: customerId,
      description: `Bid on: ${jobTitle}`,
      metadata: {
        type: 'pay_per_bid',
        job_id: jobId,
        job_title: jobTitle
      },
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      }
    });

    console.log(`✓ Pay-per-bid charge created: ${paymentIntent.id} for job ${jobId}`);
    return paymentIntent;
  } catch (error) {
    console.error('Error charging for bid:', error.message);
    throw new Error(`Failed to charge for bid: ${error.message}`);
  }
}

/**
 * Get customer's subscription status
 */
async function getSubscriptionStatus(customerId) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10
    });

    if (subscriptions.data.length === 0) {
      return {
        hasSubscription: false,
        status: 'none',
        plan: null
      };
    }

    // Get active or trialing subscription
    const activeSubscription = subscriptions.data.find(s =>
      s.status === 'active' || s.status === 'trialing'
    );

    if (activeSubscription) {
      return {
        hasSubscription: true,
        status: activeSubscription.status,
        plan: activeSubscription.metadata.plan_id,
        currentPeriodEnd: new Date(activeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
        subscription: activeSubscription
      };
    }

    // Check for past_due or unpaid
    const problematicSubscription = subscriptions.data.find(s =>
      s.status === 'past_due' || s.status === 'unpaid'
    );

    if (problematicSubscription) {
      return {
        hasSubscription: true,
        status: problematicSubscription.status,
        plan: problematicSubscription.metadata.plan_id,
        currentPeriodEnd: new Date(problematicSubscription.current_period_end * 1000),
        subscription: problematicSubscription
      };
    }

    return {
      hasSubscription: false,
      status: 'none',
      plan: null
    };
  } catch (error) {
    console.error('Error getting subscription status:', error.message);
    throw new Error(`Failed to get subscription status: ${error.message}`);
  }
}

/**
 * Create setup intent for saving payment method
 */
async function createSetupIntent(customerId) {
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      metadata: {
        source: 'homeprohub'
      }
    });

    console.log(`✓ Setup intent created: ${setupIntent.id}`);
    return setupIntent;
  } catch (error) {
    console.error('Error creating setup intent:', error.message);
    throw new Error(`Failed to create setup intent: ${error.message}`);
  }
}

/**
 * Get customer's payment methods
 */
async function getPaymentMethods(customerId) {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    return paymentMethods.data;
  } catch (error) {
    console.error('Error getting payment methods:', error.message);
    throw new Error(`Failed to get payment methods: ${error.message}`);
  }
}

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    throw new Error('Invalid signature');
  }
}

/**
 * Get plan details
 */
function getPlanDetails(planId) {
  return PLANS[planId] || null;
}

/**
 * Get all plans
 */
function getAllPlans() {
  return PLANS;
}

module.exports = {
  stripe,
  createCustomer,
  createSubscription,
  cancelSubscription,
  updateSubscription,
  chargeForBid,
  getSubscriptionStatus,
  createSetupIntent,
  getPaymentMethods,
  verifyWebhookSignature,
  getPlanDetails,
  getAllPlans,
  PLANS,
  PAY_PER_BID_PRICE
};
