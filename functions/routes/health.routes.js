const { Router } = require('express');

const router = Router();

router.get('/', (req, res) => res.json({ ok: true, service: 'waradly-api' }));

module.exports = router;
