/**
 * Pure helper: derive the active plan name from a RevenueCat CustomerInfo object.
 *
 * Kept in a native-free module so unit tests can import it without mocking
 * react-native-purchases or any other native dependency.
 *
 * Uses CommonJS exports so Jest can consume it without a transform step.
 */

const { ENTITLEMENT } = require('../constants/planLimits');

/**
 * Returns 'unlimited' | 'pro' | 'starter' | 'free' based on the
 * active entitlements in a RevenueCat CustomerInfo object.
 *
 * @param {object|null} customerInfo - CustomerInfo from RevenueCat SDK
 * @returns {'unlimited'|'pro'|'starter'|'free'}
 */
function activePlanFromCustomerInfo(customerInfo) {
  const active = customerInfo?.entitlements?.active ?? {};
  if (active[ENTITLEMENT.UNLIMITED]) return 'unlimited';
  if (active[ENTITLEMENT.PRO])       return 'pro';
  if (active[ENTITLEMENT.STARTER])   return 'starter';
  return 'free';
}

module.exports = { activePlanFromCustomerInfo };
