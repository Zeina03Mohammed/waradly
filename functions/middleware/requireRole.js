const { Errors } = require('../http/errors');

/** Usage: router.get('/x', authenticate, requireRole('admin'), handler) */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return next(Errors.forbidden());
    next();
  };
}

module.exports = { requireRole };
