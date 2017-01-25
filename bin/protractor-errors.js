#! /usr/bin/env node
const shell = require("shelljs");
const args = process.argv.slice(2);
const timestamp = (new Date()).toISOString();

args.push('--params.currentTime');
args.push(timestamp);

shell.exec('./node_modules/protractor/bin/protractor ' + args.join(' '));    
