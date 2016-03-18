if(!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY || !process.env.S3_BUCKET){
	console.log('Enviroment variables S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_BUCKET are required.');
	return;
}

var utils = require('./utils');
var packageIndexUrl = 'https://downloads.arduino.cc/packages/package_index.json';
var arduinoBuilderUrl = 'https://api.github.com/repos/arduino/arduino-builder/releases';

var hostMapAvrGcc = {
	linux: {
		x64 : 'x86_64-linux-gnu',
		ia32 : 'i686-linux-gnu'
	},
	darwin: {
		x64 : 'i386-apple-darwin11'
	},
	win32: {
		ia32 : 'i686-mingw32'
	}
};
var hostMapArduinoBuilder = {
	linux: {
		x64 : {slug:'linux64', ext: 'tar.bz2' },
		ia32 : {slug:'linux32', ext: 'tar.bz2' }
	},
	darwin: {
		x64 : {slug:'macosx', ext: 'tar.bz2' }
	},
	win32: {
		ia32 : {slug:'windows', ext: 'zip' }
	}
};

switch (process.argv[2]) {
	case 'avr-gcc':
		utils.pass(packageIndexUrl)
		.then(utils.clear)
		.then(utils.get)
		.then(utils.extractToolsFromPackage('avr-gcc'))
		.then(utils.extractFlatListFromTools(hostMapAvrGcc))
		.then(utils.processList)
		.then(utils.clear)
		.catch(function (error) {
			console.log('error', error);
		});
		break;
	case 'avrdude':
		utils.pass(packageIndexUrl)
		.then(utils.clear)
		.then(utils.get)
		.then(utils.extractToolsFromPackage('avrdude'))
		.then(utils.extractFlatListFromTools(hostMapAvrGcc))
		.then(utils.processList)
		.then(utils.clear)
		.catch(function (error) {
			console.log('error', error);
		});
		break;
	case 'arduino-builder':
		utils.pass(arduinoBuilderUrl)
		.then(utils.clear)
		.then(utils.get)
		.then(utils.extractLatestTagsFromReleases)
		.then(utils.extractFlatListFromTags(hostMapArduinoBuilder))
		.then(utils.processList)
		.then(utils.clear)

		.catch(function (error) {
			console.log('error', error);
		});
		break;
	default:
		console.log('You need to specify one of the command line arguments:\n- arduino-builder\n- avr-gcc\n- avrdude');
		break;
}
