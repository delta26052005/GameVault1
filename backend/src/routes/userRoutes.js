const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile', authMiddleware, (req, res) => {
	res.status(200).json({
		message: 'Protected profile route accessed',
		userId: req.user.userId
	});
});

module.exports = router;
