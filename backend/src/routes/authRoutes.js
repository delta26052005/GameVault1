const express = require('express');
const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

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

router.post('/login', async (req, res) => {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			return res.status(400).json({
				message: 'Email and password are required'
			});
		}

		const user = await User.findOne({ email });

		if (!user) {
			return res.status(401).json({
				message: 'Invalid email or password'
			});
		}

		const passwordMatches = await bcrypt.compare(password, user.password);

		if (!passwordMatches) {
			return res.status(401).json({
				message: 'Invalid email or password'
			});
		}

		const token = jwt.sign(
			{ userId: user._id },
			process.env.JWT_SECRET,
			{ expiresIn: '1h' }
		);

		return res.status(200).json({
			message: 'Login successful',
			token,
			user: {
				id: user._id,
				username: user.username,
				email: user.email
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		return res.status(500).json({
			message: 'Server error'
		});
	}
});

module.exports = router;
