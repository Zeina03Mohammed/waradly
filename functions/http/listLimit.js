const LIST_LIMIT = 200;

/** Caps an admin list query. Newest-first only when unfiltered — a where() + orderBy() pair needs
 * its own composite index per filter combo, and filtered lists are already narrow.
 * ponytail: hard cap with has_more, add a startAfter cursor + "Load more" when admins need older rows. */
async function latest(query, { filtered = false } = {}) {
  const ordered = filtered ? query : query.orderBy('created_at', 'desc');
  const snap = await ordered.limit(LIST_LIMIT + 1).get();
  return { docs: snap.docs.slice(0, LIST_LIMIT), has_more: snap.size > LIST_LIMIT };
}

module.exports = { latest, LIST_LIMIT };
