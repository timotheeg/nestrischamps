import tzs from 'timezones.json';

const timezones = tzs
	.reduce((acc, o) => {
		return acc.push(...o.utc), acc;
	}, [])
	.filter(tz => !tz.startsWith('Etc/'))
	.filter(tz => tz.includes('/'));

const timezones_extras = [
	'UTC',
	'US/Alaska',
	'US/Pacific',
	'US/Central',
	'US/Indiana-Starke',
	'US/Arizona',
	'US/East-Indiana',
	'US/Eastern',
	'US/Hawaii',
	'US/Aleutian',
	'US/Michigan',
	'US/Mountain',
	'US/Samoa',
];

timezones.push(...timezones_extras);

const tz_set = new Set(timezones); // to remove duplicates

// Here's hoping the resultant set is a strict subset of Postgres:
// "SELECT name FROM pg_timezone_names;"

export default [...tz_set].sort();
