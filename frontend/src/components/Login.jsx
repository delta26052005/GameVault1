import { useState } from 'react';

function Login() {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState('');

	async function handleSubmit(event) {
		event.preventDefault();

		try {
			const response = await fetch('http://localhost:5000/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password })
			});
			const data = await response.json();

			if (response.ok) {
				localStorage.setItem('token', data.token);
				setMessage('Login successful');
			} else {
				setMessage(data.message);
			}
		} catch (error) {
			console.error('Login failed:', error);
			setMessage('Login failed');
		}
	}

	return (
		<form onSubmit={handleSubmit}>
			<input
				type="email"
				placeholder="Email"
				value={email}
				onChange={(event) => setEmail(event.target.value)}
			/>
			<input
				type="password"
				placeholder="Password"
				value={password}
				onChange={(event) => setPassword(event.target.value)}
			/>
			<button type="submit">Login</button>
			{message && <p>{message}</p>}
		</form>
	);
}

export default Login;
