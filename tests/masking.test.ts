import { describe, expect, it } from 'vitest';
import {
  toPublicOrganizationView,
  toPublicSupplierView,
  toSelfOrganizationView,
  toAdminOrganizationView,
  type OrganizationRecord,
  type SupplierProfileRecord,
} from '@/lib/masking/organization';

const RESTRICTED_KEYS = ['legal_name', 'exact_address', 'tax_id', 'owner_user_id', 'phone', 'email', 'whatsapp'];

const buyerOrg: OrganizationRecord = {
  id: 'org-buyer-1',
  type: 'buyer',
  legal_name: 'Acme Importing LLC',
  display_name: null,
  country: 'Egypt',
  general_region: 'Cairo',
  exact_address: '123 Secret Street, Building 4, Cairo',
  tax_id: 'TAX-12345',
  logo_file_id: 'file-logo-1',
};

const supplierOrg: OrganizationRecord = {
  id: 'org-supplier-1',
  type: 'supplier',
  legal_name: 'Nile Textiles Co.',
  display_name: 'Supplier #2847',
  country: 'Egypt',
  general_region: 'Alexandria',
  exact_address: 'Industrial Zone 9, Alexandria',
  tax_id: 'TAX-99999',
  logo_file_id: 'file-logo-2',
};

const supplierProfile: SupplierProfileRecord = {
  id: 'supplier-profile-1',
  anonymized_id: 'Supplier #2847',
  verification_status: 'verified',
  completed_orders_count: 12,
  average_rating: 4.5,
};

describe('identity masking — counterpart views never contain restricted fields', () => {
  it('a buyer-facing supplier payload never contains the buyer org restricted fields', () => {
    // This simulates what a SUPPLIER receives when a buyer's org is embedded in an RFQ response.
    const payload = toPublicOrganizationView(buyerOrg);

    for (const key of RESTRICTED_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(payload, key)).toBe(false);
    }
    expect(payload).toEqual({
      id: 'org-buyer-1',
      display_name: null,
      country: 'Egypt',
      general_region: 'Cairo',
    });
  });

  it('a supplier-facing buyer payload (public supplier view) never contains supplier restricted fields', () => {
    // This simulates what a BUYER receives when comparing offers (Section 9.3/5.8).
    const payload = toPublicSupplierView(supplierOrg, supplierProfile);

    for (const key of RESTRICTED_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(payload, key)).toBe(false);
    }
    expect(payload).toEqual({
      id: 'org-supplier-1',
      display_name: 'Supplier #2847',
      country: 'Egypt',
      general_region: 'Alexandria',
      supplier_id: 'supplier-profile-1',
      anonymized_id: 'Supplier #2847',
      completed_orders_count: 12,
      average_rating: 4.5,
    });
  });

  it('never leaks the logo file unless explicitly opted in (awarded-order exception only)', () => {
    const withoutLogo = toPublicOrganizationView(supplierOrg);
    expect(withoutLogo.logo_file_id).toBeUndefined();

    const withLogo = toPublicOrganizationView(supplierOrg, { includeLogo: true });
    expect(withLogo.logo_file_id).toBe('file-logo-2');
    // Even when the logo exception applies, no other restricted field rides along with it.
    for (const key of RESTRICTED_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(withLogo, key)).toBe(false);
    }
  });

  it('self and admin views are allowed to contain the full fields (sanity check the allowlist is intentional, not accidental)', () => {
    const self = toSelfOrganizationView(buyerOrg);
    expect(self.legal_name).toBe('Acme Importing LLC');
    expect(self.exact_address).toBe('123 Secret Street, Building 4, Cairo');

    const admin = toAdminOrganizationView({ ...buyerOrg, owner_user_id: 'user-1' });
    expect(admin.legal_name).toBe('Acme Importing LLC');
    expect(admin.owner_user_id).toBe('user-1');
  });
});
