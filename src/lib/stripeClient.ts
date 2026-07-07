import { loadStripe, type Stripe } from "@stripe/stripe-js";

let _stripePromise: Promise<Stripe | null> | undefined;

export function getStripe(): Promise<Stripe | null> {
  if (!_stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
    _stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return _stripePromise;
}
