function timingDecorator(name, func) { // func must be prebound
	return function(...args) {
		performance.mark(`start_${name}`);

		const res = func(...args);

		performance.mark(`end_${name}`);
		performance.measure(name, `start_${name}`, `end_${name}`);

		return res;
	}
}
