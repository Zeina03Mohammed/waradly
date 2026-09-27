const { Router } = require('express');
const { db } = require('../config/firebase');
const { asyncHandler } = require('../http/errorHandler');
const { authenticate } = require('../middleware/authenticate');
const { requireRole } = require('../middleware/requireRole');

const router = Router();
router.use(authenticate, requireRole('admin'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [pendingSuppliers, rfqsAwaitingReview, flaggedMessages, openDisputes, ordersSnap] = await Promise.all([
      db.collection('organizations').where('supplier_profile.verification_status', '==', 'pending').count().get(),
      db.collection('rfqs').where('status', 'in', ['SUBMITTED', 'UNDER_REVIEW']).count().get(),
      db.collectionGroup('flags').where('status', '==', 'pending_review').count().get(),
      db.collection('disputes').where('status', '==', 'open').count().get(),
      db.collection('orders').select('status').get(),
    ]);

    const ordersByStatus = {};
    for (const doc of ordersSnap.docs) {
      const status = doc.data().status;
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    }

    res.json({
      pending_supplier_approvals: pendingSuppliers.data().count,
      rfqs_awaiting_review: rfqsAwaitingReview.data().count,
      flagged_messages: flaggedMessages.data().count,
      open_disputes: openDisputes.data().count,
      orders_by_status: ordersByStatus,
    });
  }),
);

module.exports = router;
