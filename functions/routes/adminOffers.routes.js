const { Router } = require('express');
const { z } = require('zod');
const { db } = require('../config/firebase');
const { Errors } = require('../http/errors');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { zodFieldErrors } = require('../validation/auth');
const { getOfferById } = require('../services/offerService');
const { serializeOfferFor } = require('../masking/offer');
const { audit } = require('../services/auditService');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    let query = db.collection('offers');
    if (req.query.rfq_id) query = query.where('rfq_id', '==', req.query.rfq_id);
    if (req.query.supplier_id) query = query.where('supplier_id', '==', req.query.supplier_id);
    if (req.query.status) query = query.where('status', '==', req.query.status);

    const snap = await query.get();
    res.json({ offers: snap.docs.map((d) => serializeOfferFor('admin', { id: d.id, ...d.data() })) });
  }),
);

const flagSchema = z.object({ note: z.string().trim().max(1000) });

router.patch(
  '/:id/flag',
  asyncHandler(async (req, res) => {
    const parsed = flagSchema.safeParse(req.body);
    if (!parsed.success) throw Errors.validation(zodFieldErrors(parsed.error));

    const offer = await getOfferById(req.params.id);
    if (!offer) throw Errors.notFound();

    await db.collection('offers').doc(offer.id).update({ admin_flag_note: parsed.data.note || null, updated_at: new Date() });
    await audit({ actorId: req.user.id, action: 'offer.flagged', entityType: 'offer', entityId: offer.id, after: { note: parsed.data.note } });

    res.json({ ok: true });
  }),
);

module.exports = router;
