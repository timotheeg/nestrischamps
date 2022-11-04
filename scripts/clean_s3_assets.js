import dbPool from '../modules/db.js';
import _ from 'lodash';
import {
	S3Client,
	ListObjectsV2Command,
	DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

const bucket = 'nestrischamps';
let restituted = {
	num_files: 0,
	size: 0,
};

process.on('SIGINT', function () {
	console.log('');
	console.error(`Report:`, restituted);
	process.exit();
});

(async function run() {
	const dbClient = await dbPool.connect();
	const s3Client = new S3Client({
		region: 'us-west-1',
	});

	const listParams = {
		Bucket: bucket,
		FetchOwner: false,
		Prefix: 'games/',
	};

	let num_list_query = 0;
	let response;

	const to_delete = [];

	async function deleteKeys(items) {
		const size = items.reduce((acc, item) => acc + item.Size, 0);

		console.log(`Deleting ${items.length} to restitute ${size}`);

		restituted.num_files += items.length;
		restituted.size += size;

		await s3Client.send(
			new DeleteObjectsCommand({
				Bucket: bucket,
				Delete: {
					Objects: items,
				},
			})
		);
	}

	do {
		console.log(
			`List Query ${++num_list_query} from ${listParams.ContinuationToken}`
		);

		response = await s3Client.send(new ListObjectsV2Command(listParams));

		// We only look for files that have been modified more than 2h ago;
		const now = Date.now();
		const candidates = response.Contents.filter(
			item => now - item.LastModified.getTime() > 2 * 60 * 60 * 1000
		);

		for (const chunk of _.chunk(candidates, 250)) {
			let rows = (
				await dbClient.query(
					`
						SELECT id, frame_file
						FROM scores
						WHERE frame_file IN (${chunk.map(f => `'${f.Key}'`).join(',')})
					`,
					[]
				)
			).rows;

			console.log(
				`Found ${chunk.length - rows.length} unlisted files (${rows.length}/${
					chunk.length
				})`
			);

			if (rows.length >= chunk.length) continue; // all files found

			const available = new Set([...rows.map(r => r.frame_file)]);

			to_delete.push(...chunk.filter(item => !available.has(item.Key)));

			if (to_delete.length >= 1000) {
				try {
					await deleteKeys(to_delete.splice(0, 1000));
				} catch (err) {
					console.error(err);
					// process.exit(1);
				}
			}
		}

		console.log(`Scheduled for deletion ${to_delete.length}`);

		listParams.ContinuationToken = response.NextContinuationToken;
	} while (response.IsTruncated);

	if (to_delete.length) {
		await deleteKeys(to_delete);
	}

	console.log(restituted);
	process.exit(0);
})();
