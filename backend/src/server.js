const express = require('express');

const app = express();
const port = 5000;

// Allow the server to receive JSON request bodies.
app.use(express.json());

app.get('/api/health', (req, res) => {
	res.json({
		status: 'ok',
		message: 'GameVault backend is running'
	});
});

app.listen(port, () => {
	console.log(`GameVault backend is running on port ${port}`);
});
