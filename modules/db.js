if (process.env.IS_PUBLIC_SERVER) {
	const { Pool } = require('pg');

	module.exports = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false
		}
	});
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