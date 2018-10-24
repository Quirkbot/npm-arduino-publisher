const fs = require('fs').promises
const path = require('path')
const fetch = require('node-fetch')
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
	await extract(
		path.join(TEMP, item.dst),
		path.join(DIST, item.newName),
		item
	)
	console.log('extracted!')

	// clone
	console.log('clonning...')
	const cloneSrc = path.join(DIST, item.newName)
	const cloneTmp = path.join(DIST, `${item.newName}tmp`)
	await execute(
		`cp -r ${cloneSrc} ${cloneTmp} && rm -r ${cloneSrc} && mv ${cloneTmp} ${cloneSrc}`
	)
	console.log('clonned!')

	console.log('SUCCESS:', item.newName)
}

const init = async () => {
	await rimraf(TEMP)
	await rimraf(DIST)
	await fs.mkdir(TEMP)
	await fs.mkdir(DIST)

	let flatList
	switch (process.argv[2]) {
		case 'arduino-builder': {
			const releases = await (await fetch(arduinoBuilderUrl)).json()
			const tags = await extractLatestTagsFromReleases(releases)
			flatList = await extractFlatListFromTags(hostMapArduinoBuilder, tags)
			break
		}
		case 'avr-gcc': {
			const packageIndex = await (await fetch(packageIndexUrl)).json()
			const tools = await extractToolsFromPackage('avr-gcc', packageIndex)
			flatList = await extractFlatListFromTools(hostMapAvrGcc, tools)
			break
		}
		case 'avrdude': {
			const packageIndex = await (await fetch(packageIndexUrl)).json()
			const tools = await extractToolsFromPackage('avrdude', packageIndex)
			flatList = await extractFlatListFromTools(hostMapAvrGcc, tools)
			break
		}
		default:
			break
	}
	for (let i = 0; i < flatList.length; i++) {
		await processItem(flatList[i])
	}
	await execute('sh fixsymlinks.sh')
}
init()
