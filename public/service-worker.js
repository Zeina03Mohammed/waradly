// ponytail: passthrough only, no caching — this is a live marketplace (auth, RFQs, prices),
// caching responses risks serving stale data. Exists only so Chrome/Android treat the site as
// installable. Add real offline caching later if that's ever actually needed.
self.addEventListener('fetch', () => {});
