if (process.env.IS_PUBLIC_SERVER) {
	const { Pool } = require('pg');

	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false
		}
	});

	// the pool will emit an error on behalf of any idle clients
	// it contains if a backend error or network partition happens
	pool.on('error', (err, client) => {
		console.error('DB: Unexpected error on idle client', err);
	});

	module.exports = pool;
}
else {
	// Fake Pool for local access
	// TODO: make a sqlite version
	module.exports = {
		async connect() {
			return {
				async query() {
					return {
						rows: [ {} ]
					};
				}
			};
		}
	};
}