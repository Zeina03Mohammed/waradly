/**
 * Secrets that sign auth tokens / file URLs must never silently fall back to a value that's
 * sitting in plain sight in the source. In dev, missing the env var is a convenience issue
 * (use the .env.example default and move on); in production it's a full auth bypass — anyone
 * who has read this file knows the fallback string and can forge valid tokens. Fail loudly
 * instead.
 */
export function requiredSecret(envVarName: string, devFallback: string): string {
  const value = process.env[envVarName];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`${envVarName} must be set in production — refusing to start with a guessable default secret.`);
  }
  return devFallback;
}
