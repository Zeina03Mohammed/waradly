const { Router } = require('express');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');
const { listAuditLogsFiltered } = require('../services/auditService');
const { attachEntityLabels } = require('../services/entityLabelsService');

const router = Router();
router.use(authenticate, requireRole('admin'));

// Append-only, read-only — no update/delete route at any role, per SPEC.md Section 19.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const logs = await listAuditLogsFiltered({
      actorId: req.query.actor_id,
      entityType: req.query.entity_type,
      from: req.query.from,
      to: req.query.to,
    });
    res.json({ audit_logs: await attachEntityLabels(logs) });
  }),
);

module.exports = router;
