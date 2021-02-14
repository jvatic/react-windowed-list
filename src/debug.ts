let enabled = false;

export function enableDebug() {
	if (enabled) return;
	enabled = true;
	console.log('debug enabled');
}

export function disableDebug() {
	enabled = false;
}

export function debug(...args: any) {
	if (!enabled) return;
	console.log(...args);
}
