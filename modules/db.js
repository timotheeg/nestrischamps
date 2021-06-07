const { Pool } = require('pg');

if (process.env.IS_PUBLIC_SERVER) {
	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false,
		},
	});

	// the pool will emit an error on behalf of any idle clients
	// it contains if a backend error or network partition happens
	pool.on('error', (err, client) => {
		console.error('DB: Unexpected error on idle client', err);
	});

	module.exports = pool;
} else {
	/*
	// Fake Pool for local access
	// TODO: make a sqlite version

	async function query(query, args) {
		console.log('Executing query');
		console.log(query);
		console.log(args);

		return {
			rows: [ {} ]
		};
	}

	module.exports = {
		async connect() {
			return {
				query,
			};
		},

		query,
	};
	/**/

	const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
	});

	// the pool will emit an error on behalf of any idle clients
	// it contains if a backend error or network partition happens
	pool.on('error', (err, client) => {
		console.error('DB: Unexpected error on idle client', err);
	});

	module.exports = pool;
}
