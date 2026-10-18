const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const app = require('./app');
const { expireRfqs } = require('./jobs/expireRfqs');

exports.api = onRequest(app);
exports.expireRfqs = onSchedule('every 1 hours', () => expireRfqs());
