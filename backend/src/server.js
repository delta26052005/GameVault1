const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();
const port = 5000;

app.use(cors());

// Allow the server to receive JSON request bodies.
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.get('/api/health', (req, res) => {
	res.json({
		status: 'ok',
		message: 'GameVault backend is running'
	});
});

async function startServer() {
	await connectDB();

	app.listen(port, () => {
		console.log(`GameVault backend is running on port ${port}`);
	});
}

startServer();
