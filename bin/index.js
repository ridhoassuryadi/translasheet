#!/usr/bin/env node
const args = require('yargs').argv;
const createJsonTranslations = require('../index');

createJsonTranslations(args)