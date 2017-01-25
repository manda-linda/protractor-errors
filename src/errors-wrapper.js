'use strict';

function wrapper() {
    var global = Function('return this')(),
        processFiles = require('./errors-file-processor.js'),
        jasmineReporter = require('jasmine-reporters'),
        errorList = [];
    if (!browser || !browser.params || !jasmine  || !browser.params.currentTime) {
        console.error('Missing browser.params required for protractor-errors');
        return; 
    }

    const junitOptions = {
                savePath: './' + browser.params.errorsPath + '/' + browser.params.currentTime,
                consolidateAll: false
            };
    jasmine.getEnv().addReporter(new jasmineReporter.JUnitXmlReporter(junitOptions));
    if (!browser.params.errorsRun || !(browser.params.errorsRun === 'true' || browser.params.errorsRun === 'True')) {
        return;
    }
    const errorsDirectory = browser.params.errorsPath,
        ignoreDirectory = browser.params.currentTime;
    try {
        errorList = processFiles(errorsDirectory, ignoreDirectory);
    } catch (e) {
        console.log("Previous Errors Reference Not Found.");
        console.log(e);
        errorList = [];
    }

    var jasminexIt,
        jasmineFit,
        jasmineIt;

    defineOverrides();

    function shouldRunSpec(description) {
        for (var i = 0; i < errorList.length; i++) {
            if (errorList[i].name.trim().toLowerCase() === description.trim().toLowerCase()) {
                return true;
            }
        }
        return false;
    }

    //@TODO In es6 should use spread operator
    function wrapIt() {
        if (shouldRunSpec(arguments[0])) {
            jasmineFit(arguments[0], arguments[1], arguments[2]);

        } else {
            customxit(arguments[0], arguments[1], arguments[2]);
        }
    };

    function customxit() {
        var spec = jasmineIt.apply(this, arguments);
        spec.disable('Temporarily disabled for errors run');
        return spec;
    }

    function defineOverrides() {
        jasmineIt = global.it;
        jasminexIt = global.xit;
        jasmineFit = global.fit;
        global.it = global.fit = wrapIt;
        global.fdescribe = global.describe;
        global.xit = customxit;
    }
};
module.exports = wrapper;
