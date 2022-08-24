import { overwrite, getData } from 'country-list';

overwrite([
	{
		code: 'TW',
		name: 'Taiwan',
	},
	{
		code: 'GB',
		name: 'United Kingdom',
	},
]);

export const countries = getData().sort((a, b) => (a.name < b.name ? -1 : 1)); // Sort by country name
