module.exports = (object, path) => {
	try {
		const paths = path.split('.')
		let current = object

		for (let i = 0; i < paths.length; ++i) {
			if (current[paths[i]] === undefined) {
				return undefined
			}
			current = current[paths[i]]
		}
		return current
	} catch (e) {}
	return undefined
}
