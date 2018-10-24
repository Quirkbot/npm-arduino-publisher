const findOneIndexByKey = require('./findOneIndexByKey')

module.exports = (list, path, value) => {
	if (!list || !list.length) {
		return undefined
	}
	const index = findOneIndexByKey(list, path, value)
	return list[index]
}
