import { describe, expect, it } from 'vitest';
import { detectContactInfo, maskContactInfo } from '@/lib/messages/detect';

describe('contact-info detection (SPEC.md Section 11)', () => {
  it('detects an email address', () => {
    const matches = detectContactInfo('Reach me at buyer@example.com for details.');
    expect(matches).toEqual([{ type: 'email', text: 'buyer@example.com' }]);
  });

  it('detects a phone number', () => {
    const matches = detectContactInfo('Call me at +1 555-123-4567 anytime.');
    expect(matches.some((m) => m.type === 'phone')).toBe(true);
  });

  it('detects a URL', () => {
    const matches = detectContactInfo('Check my site www.example-supplier.com for a catalog.');
    expect(matches.some((m) => m.type === 'url')).toBe(true);
  });

  it('detects multiple distinct matches in one message', () => {
    const matches = detectContactInfo('Email me: seller@shop.com or visit https://shop.com/catalog');
    const types = matches.map((m) => m.type).sort();
    expect(types).toEqual(['email', 'url']);
  });

  it('does not flag an ordinary message with no contact info', () => {
    expect(detectContactInfo('The quantity looks good, please confirm the lead time.')).toEqual([]);
  });

  it('redacts every detected match and nothing else', () => {
    const content = 'Contact me at buyer@example.com or +1 555-123-4567.';
    const matches = detectContactInfo(content);
    const masked = maskContactInfo(content, matches);
    expect(masked).not.toContain('buyer@example.com');
    expect(masked).not.toContain('555-123-4567');
    expect(masked).toContain('[redacted]');
    expect(masked).toContain('Contact me at');
  });
});
