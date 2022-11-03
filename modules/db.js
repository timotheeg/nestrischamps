import pg from 'pg';

let pool;

if (process.env.IS_PUBLIC_SERVER) {
	pool = new pg.Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false,
		},
	});

	// the pool will emit an error on behalf of any idle clients
	// it contains if a backend error or network partition happens
	pool.on('error', err => {
		console.error('DB: Unexpected error on idle client', err);
	});
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

	console.log('DEV DB', process.env.DATABASE_URL);
	pool = new pg.Pool({
		connectionString: process.env.DATABASE_URL,
		/*
		ssl: {
			rejectUnauthorized: false,
		},
		/**/
	});

	// the pool will emit an error on behalf of any idle clients
	// it contains if a backend error or network partition happens
	pool.on('error', err => {
		console.error('DB: Unexpected error on idle client', err);
	});
}

export default pool;
