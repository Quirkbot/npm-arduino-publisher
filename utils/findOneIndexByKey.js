const getDeep = require('./getDeep')

module.exports = (list, path, value) => {
	if (!list || !list.length) {
		return -1
	}

	for (let i = 0; i < list.length; i++) {
		if (getDeep(list[i], path) === value) {
			return i
		}
	}
	return -1
}
