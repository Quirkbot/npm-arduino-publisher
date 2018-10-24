module.exports = (releases, limit = 1) =>
	releases
		.map((item) => item.tag_name)
		.filter((tag, index) => index < limit)
