const fs = require('fs').promises
const path = require('path')
const fetch = require('node-fetch')
const cpdir = require('./utils/cpdir')
const download = require('./utils/download')
const execute = require('./utils/execute')
const extractFlatListFromTags = require('./utils/extractFlatListFromTags')
const extractFlatListFromTools = require('./utils/extractFlatListFromTools')
const extractLatestTagsFromReleases = require('./utils/extractLatestTagsFromReleases')
const extractTarBz2 = require('./utils/extractTarBz2')
const extractTarZip = require('./utils/extractTarZip')
const extractToolsFromPackage = require('./utils/extractToolsFromPackage')
const rimraf = require('./utils/rimraf')

const TEMP = path.resolve('.downloads')
const DIST = path.resolve('dist')
const target = process.argv[2]

const packageIndexUrl = 'https://downloads.arduino.cc/packages/package_index.json'
const arduinoBuilderUrl = 'https://api.github.com/repos/arduino/arduino-builder/releases'

const hostMapAvrGcc = {
	linux : {
		ia32 : 'i686-linux-gnu',
		x64  : 'x86_64-linux-gnu',
	},
	darwin : {
		x64 : 'i386-apple-darwin11'
	},
	win32 : {
		ia32 : 'i686-mingw32',
		x64  : 'i686-mingw32',
	}
}
const hostMapArduinoBuilder = {
	linux : {
		ia32 : { slug : 'linux32', ext : 'tar.bz2' },
		x64  : { slug : 'linux64', ext : 'tar.bz2' },
	},
	darwin : {
		x64 : { slug : 'macosx', ext : 'tar.bz2' }
	},
	win32 : {
		ia32 : { slug : 'windows', ext : 'zip' },
		x64  : { slug : 'windows', ext : 'zip' },
	}
}

const processItem = async (item) => {
	console.log('START:', item.newName)
	// download
	console.log('downloading...', item.url)
	await download(item.url, path.join(TEMP, item.dst))
	console.log('downloaded!')

	// extract
	let extract
	if (item.dst.indexOf('.tar.bz2') !== -1) {
		extract = extractTarBz2
	} else if (item.dst.indexOf('.zip') !== -1) {
		extract = extractTarZip
	}
	console.log('extracting...', item.dst, item.newName)
	await rimraf(path.join(DIST, item.newName))
	await extract(
		path.join(TEMP, item.dst),
		path.join(DIST, item.newName),
		item
	)
	console.log('extracted!')

	// clone
	console.log('cloning...')
	const cloneSrc = path.join(DIST, item.newName)
	const cloneTmp = path.join(DIST, `${item.newName}tmp`)
	await cpdir(cloneSrc, cloneTmp)
	await rimraf(cloneSrc)
	await fs.rename(cloneTmp, cloneSrc)
	console.log('cloned!')

	console.log('SUCCESS:', item.newName)
}

const init = async () => {
	await rimraf(TEMP)
	// await rimraf(DIST)
	await fs.mkdir(TEMP)
	try {
		await fs.mkdir(DIST)
	} catch (e) {}


	let flatList = []
	switch (target) {
		case 'arduino-builder': {
			const releases = await (await fetch(arduinoBuilderUrl)).json()
			const tags = await extractLatestTagsFromReleases(releases)
			flatList = await extractFlatListFromTags(hostMapArduinoBuilder, tags)
			break
		}
		default: {
			const packageIndex = await (await fetch(packageIndexUrl)).json()
			const tools = await extractToolsFromPackage(target, packageIndex)
			flatList = await extractFlatListFromTools(hostMapAvrGcc, tools)
			break
		}
	}
	for (let i = 0; i < flatList.length; i++) {
		await processItem(flatList[i])
	}
	console.log('doing fixsymlinks')
	await execute('sh fixsymlinks.sh')
	console.log('remove temp')
	await rimraf(TEMP)
	console.log('END')
}
init()
