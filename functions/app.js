const express = require('express');
const cors = require('cors');
const { errorHandler } = require('./http/errorHandler');
const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const webauthnRoutes = require('./routes/webauthn.routes');
const usersRoutes = require('./routes/users.routes');
const organizationsRoutes = require('./routes/organizations.routes');
const filesRoutes = require('./routes/files.routes');
const { publicRouter: categoriesPublicRoutes, adminRouter: categoriesAdminRoutes } = require('./routes/categories.routes');
const suppliersRoutes = require('./routes/suppliers.routes');
const adminSuppliersRoutes = require('./routes/adminSuppliers.routes');
const rfqsRoutes = require('./routes/rfqs.routes');
const adminRfqsRoutes = require('./routes/adminRfqs.routes');
const offersRoutes = require('./routes/offers.routes');
const adminOffersRoutes = require('./routes/adminOffers.routes');
const ordersRoutes = require('./routes/orders.routes');
const adminOrdersRoutes = require('./routes/adminOrders.routes');
const conversationsRoutes = require('./routes/conversations.routes');
const adminMessagesRoutes = require('./routes/adminMessages.routes');
const adminDisputesRoutes = require('./routes/adminDisputes.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const adminDashboardRoutes = require('./routes/adminDashboard.routes');
const adminAuditLogsRoutes = require('./routes/adminAuditLogs.routes');
const adminUsersRoutes = require('./routes/adminUsers.routes');

const app = express();
const api = express.Router();

app.use(cors({ origin: true }));
app.use(express.json());

// Everything lives under /api — Firebase Hosting's rewrite ("/api/**" -> this function) forwards
// the full incoming path including the /api prefix, so the Express side has to expect it too.
// Local emulator testing hits the function's own URL directly (no Hosting in front of it), so
// those calls need the same /api/... prefix from here on.
api.use('/health', healthRoutes);
api.use('/auth', authRoutes);
api.use('/auth/webauthn', webauthnRoutes);
api.use('/users', usersRoutes);
api.use('/organizations', organizationsRoutes);
api.use('/files', filesRoutes);
api.use('/categories', categoriesPublicRoutes);
api.use('/admin/categories', categoriesAdminRoutes);
api.use('/suppliers', suppliersRoutes);
api.use('/admin/suppliers', adminSuppliersRoutes);
api.use('/rfqs', rfqsRoutes);
api.use('/admin/rfqs', adminRfqsRoutes);
api.use('/offers', offersRoutes);
api.use('/admin/offers', adminOffersRoutes);
api.use('/orders', ordersRoutes);
api.use('/admin/orders', adminOrdersRoutes);
api.use('/conversations', conversationsRoutes);
api.use('/admin/messages', adminMessagesRoutes);
api.use('/admin/disputes', adminDisputesRoutes);
api.use('/notifications', notificationsRoutes);
api.use('/admin/dashboard', adminDashboardRoutes);
api.use('/admin/audit-logs', adminAuditLogsRoutes);
api.use('/admin/users', adminUsersRoutes);

app.use('/api', api);
app.use(errorHandler);

module.exports = app;
