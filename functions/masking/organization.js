/** Identity-masking serializer layer — SPEC.md Section 11. Port of src/lib/masking/organization.ts.
 *
 * Every view here is built by ALLOWLIST construction (explicitly naming each field to include),
 * never by spreading the source record and deleting restricted keys. That is what makes the
 * guarantee structural: a restricted field (legal_name, exact_address, tax_id, any contact
 * field) simply has no path into a counterpart-facing view, rather than relying on someone
 * remembering to strip it. */

function toPublicOrganizationView(org, opts = {}) {
  const view = {
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

/** `org` must carry an embedded `supplier_profile` map (see plan's Firestore schema). */
function toPublicSupplierView(org, opts = {}) {
  const supplier = org.supplier_profile;
  const ratingCount = supplier.rating_count || 0;
  return {
    ...toPublicOrganizationView(org, opts),
    supplier_id: org.id,
    anonymized_id: supplier.anonymized_id,
    completed_orders_count: supplier.completed_orders_count || 0,
    average_rating: ratingCount > 0 ? supplier.rating_sum / ratingCount : null,
  };
}

function toSelfOrganizationView(org) {
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

function toAdminOrganizationView(org) {
  return { ...toSelfOrganizationView(org), owner_uid: org.owner_uid };
}

/** `viewerRelation` is decided by the caller (route handler) from ownership/role, never guessed
 * here — this function only shapes the payload once that decision has been made. */
function serializeOrganizationFor(viewerRelation, org, opts = {}) {
  switch (viewerRelation) {
    case 'self':
      return toSelfOrganizationView(org);
    case 'admin':
      return toAdminOrganizationView(org);
    case 'counterpart':
    default:
      return org.type === 'supplier' ? toPublicSupplierView(org, opts) : toPublicOrganizationView(org, opts);
  }
}

module.exports = {
  toPublicOrganizationView,
  toPublicSupplierView,
  toSelfOrganizationView,
  toAdminOrganizationView,
  serializeOrganizationFor,
};
