# npm-arduino-publisher

This very simple tool will download the binaries distributed by Arduino, prepare and upload them to s3 so they can be used in a npm (node-pre-gyp) friendly format.

It's currently being used by [npm-arduino-avr-gcc](https://github.com/Quirkbot/npm-arduino-avr-gcc) and [npm-arduino-builder](https://github.com/Quirkbot/npm-arduino-builder).

## Usage

There is only one command that can accept 1 argument. This argument controls which package will be mirrored.

#### `avr-gcc`
```
node index.js avr-gcc
```
#### `avrdude`
```
node index.js avrdude
```
#### `arduino-builder`
```
node index.js arduino-builder
```

### Environment variables

There are 3 required environment variables `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_BUCKET`, that will control where the binaries will get uploaded to.

You can set the environment variables directly from the command line, right before you invoke the script:

```
S3_ACCESS_KEY_ID="XXXXXXXXX" S3_SECRET_ACCESS_KEY="XXXXXXXXX" S3_BUCKET="npm-arduino" node index.js avr-gcc
```

