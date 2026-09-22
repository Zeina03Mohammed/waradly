/**
 * Identity-masking serializer layer — SPEC.md Section 11.
 *
 * Every view here is built by ALLOWLIST construction (explicitly naming each field to include),
 * never by spreading the source record and deleting restricted keys. That is what makes the
 * guarantee structural: a restricted field (legal_name, exact_address, tax_id, any contact
 * field) simply has no path into a counterpart-facing view, rather than relying on someone
 * remembering to strip it.
 */

export interface OrganizationRecord {
  id: string;
  type: 'buyer' | 'supplier';
  legal_name: string;
  display_name: string | null;
  country: string;
  general_region: string;
  exact_address: string | null;
  tax_id: string | null;
  logo_file_id: string | null;
}

export interface SupplierProfileRecord {
  id: string;
  anonymized_id: string;
  verification_status: string;
  completed_orders_count: number;
  average_rating: number | string | null;
}

/** What a counterpart (the other role) is ever allowed to see of an organization. */
export interface PublicOrganizationView {
  id: string;
  display_name: string | null;
  country: string;
  general_region: string;
  logo_file_id?: string | null;
}

/** Adds supplier-specific public performance fields on top of the base public org view. */
export interface PublicSupplierView extends PublicOrganizationView {
  supplier_id: string;
  anonymized_id: string;
  completed_orders_count: number;
  average_rating: number | string | null;
}

/** Full view — only ever returned to the organization's own owner. */
export interface SelfOrganizationView {
  id: string;
  type: 'buyer' | 'supplier';
  legal_name: string;
  display_name: string | null;
  country: string;
  general_region: string;
  exact_address: string | null;
  tax_id: string | null;
  logo_file_id: string | null;
}

/** Full view for Admin — same fields as self, plus nothing user-contact-specific (that comes
 * from the separate /admin/users endpoints, not this serializer). */
export interface AdminOrganizationView extends SelfOrganizationView {
  owner_user_id: string;
}

interface CounterpartViewOptions {
  /** Only ever true once an Order exists and the requester is the awarded supplier
   * (SPEC.md Section 11 exception + Section 12). */
  includeLogo?: boolean;
}

export function toPublicOrganizationView(
  org: OrganizationRecord,
  opts: CounterpartViewOptions = {},
): PublicOrganizationView {
  const view: PublicOrganizationView = {
    id: org.id,
    display_name: org.display_name,
    country: org.country,
    general_region: org.general_region,
  };
  if (opts.includeLogo) {
    view.logo_file_id = org.logo_file_id;
  }
  return view;
}

export function toPublicSupplierView(
  org: OrganizationRecord,
  supplier: SupplierProfileRecord,
  opts: CounterpartViewOptions = {},
): PublicSupplierView {
  return {
    ...toPublicOrganizationView(org, opts),
    supplier_id: supplier.id,
    anonymized_id: supplier.anonymized_id,
    completed_orders_count: supplier.completed_orders_count,
    average_rating: supplier.average_rating,
  };
}

export function toSelfOrganizationView(org: OrganizationRecord & { owner_user_id?: string }): SelfOrganizationView {
  return {
    id: org.id,
    type: org.type,
    legal_name: org.legal_name,
    display_name: org.display_name,
    country: org.country,
    general_region: org.general_region,
    exact_address: org.exact_address,
    tax_id: org.tax_id,
    logo_file_id: org.logo_file_id,
  };
}

export function toAdminOrganizationView(
  org: OrganizationRecord & { owner_user_id: string },
): AdminOrganizationView {
  return {
    ...toSelfOrganizationView(org),
    owner_user_id: org.owner_user_id,
  };
}

/**
 * Chooses the correct view for a given viewer relative to the organization being returned.
 * `viewerRelation` is decided by the caller (route handler) from ownership/role, never guessed
 * here — this function only shapes the payload once that decision has been made.
 */
export function serializeOrganizationFor(
  viewerRelation: 'self' | 'counterpart' | 'admin',
  org: OrganizationRecord & { owner_user_id: string },
  opts: CounterpartViewOptions = {},
): SelfOrganizationView | PublicOrganizationView | AdminOrganizationView {
  switch (viewerRelation) {
    case 'self':
      return toSelfOrganizationView(org);
    case 'admin':
      return toAdminOrganizationView(org);
    case 'counterpart':
    default:
      return toPublicOrganizationView(org, opts);
  }
}
