# npm-arduino-publisher

A tool to download the binaries distributed by Arduino. The
downloaded files will be placed the `./dist` directory, organized by platform
and architecture.

## Usage

The script accepts 2 arguments:
  1. Pacakge name: `avr-gcc`, `avrdude` or `arduino-builder`
  2. Number of releases to fetch: defaults to `1` (only the latest release)


### Examples

#### Download the latest release of AVR GCC
```
npm start avr-gcc
```

#### Download the latest 4 releases of Avrdude
```
npm start avrdude 4
```

#### Download the latest release of Arduino Builder
```
npm start arduino-builder 1
```

This has the same effect of running:

```
npm start arduino-builder
```
