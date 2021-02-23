function getCaptureCoordinates(template_id, capture_id) {
	const template = ocv.imread(template_id);
	const capture = ocv.imread(capture_id);

	const orb = new ocv.ORB();

	const kp1 = new ocv.KeyPointVector();
	const kp2 = new ocv.KeyPointVector();
	const des1 = new ocv.Mat();
	const des2 = new ocv.Mat();

	orb.detect(template, kp1);
	orb.compute(template, kp1, des1);

	orb.detect(capture, kp2);
	orb.compute(capture, kp2, des2);

	const bf = new ocv.BFMatcher(ocv.NORM_HAMMING, true);
	const matches = new ocv.DMatchVector();
	bf.match(des1, des2, matches);

	const local_matches = (new Array(matches.size())).fill().map((_, idx) => matches.get(idx));
	local_matches.sort((a, b) => a.distance - b.distance);

	const src_pts = local_matches
		.map(m => {
			const pt = kp1.get(m.queryIdx).pt;
			return [pt.x, pt.y];
		});

	const dst_pts = local_matches
		.map(m => {
			const pt = kp2.get(m.trainIdx).pt;
			return [pt.x, pt.y];
		});

	const src_mat = ocv.matFromArray(src_pts.length, 1, ocv.CV_64FC2, [].concat(...src_pts));
	const dst_mat = ocv.matFromArray(src_pts.length, 1, ocv.CV_64FC2, [].concat(...dst_pts));

	const transform = ocv.findHomography(src_mat, dst_mat, ocv.RANSAC, 5.0);
	const size = template.size();

	boundary_pts = ocv.matFromArray(2, 1, ocv.CV_64FC2, [
		0, 0,
		size.width, size.height,
	]);

	const target_pts = new ocv.Mat();
	ocv.perspectiveTransform(boundary_pts, target_pts, transform);

	const [l, t, r, b] = target_pts.data64F.map(v => v + 0);

	// return in [x,y,w,h] format
	return [l, t, r-l, b-t];
}
