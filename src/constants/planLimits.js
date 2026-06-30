/**
 * Plan limits and human-readable names.
 * Lives here (no native imports) so it can be imported by unit tests running
 * in a plain Node environment as well as by the RevenueCat service module.
 *
 * Uses CommonJS exports so Jest can consume it without any transform step.
 */

const ENTITLEMENT = {
  STARTER:   'starter',
  PRO:       'pro',
  UNLIMITED: 'unlimited',
};

const PLAN_LIMITS = {
  free:      1,
  starter:   10,
  pro:       50,
  unlimited: Infinity,
};

const PLAN_NAMES = {
  free:      'Free',
  starter:   'Starter',
  pro:       'Pro',
  unlimited: 'Unlimited',
};

module.exports = { ENTITLEMENT, PLAN_LIMITS, PLAN_NAMES };
