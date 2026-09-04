const express = require('express');
const User = require('../models/user');
const bcrypt = require('bcrypt');

const router = express.Router();

router.post('/register', async (req, res) => {
	try {
		const { username, email, password } = req.body;

		if (!username || !email || !password) {
			return res.status(400).json({
				message: 'Username, email, and password are required'
			});
		}

		const existingUser = await User.findOne({
			$or: [{ username }, { email }]
		});

		if (existingUser) {
			return res.status(409).json({
				message: 'Username or email already exists'
			});
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		const user = new User({ username, email, password: hashedPassword });
		const savedUser = await user.save();

		return res.status(201).json({
			message: 'User registered successfully',
			user: {
				id: savedUser._id,
				username: savedUser.username,
				email: savedUser.email
			}
		});
	} catch (error) {
		console.error('Registration error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

module.exports = router;
