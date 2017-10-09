'use strict';

var processFiles = require('./file-processor.js');
var jasmineReporter = require('jasmine-reporters');

function prepare() {
    console.log(browser.params);
    var global = Function('return this')(),
        errorList = [];

    if (!browser || !browser.params || !jasmine  || !browser.params.currentTime) {
        console.error('Missing browser.params required for protractor-errors');
        return;
    }

    var directoryName = browser.params.errorsTag ? browser.params.currentTime + '_' + browser.params.errorsTag : browser.params.currentTime;

    const junitOptions = {
        savePath: './' + browser.params.errorsPath + '/' + directoryName,
        consolidateAll: false
    };

    jasmine.getEnv().addReporter(new jasmineReporter.JUnitXmlReporter(junitOptions));
    if (!browser.params.errorsRun || !(browser.params.errorsRun === 'true' || browser.params.errorsRun === 'True')) {
        return;
    }

    try {
        errorList = browser.params.errorsList || processFiles(browser.params.errorsPath, directoryName, browser.params.errorsTag);
    } catch (e) {
        console.log("Previous Errors Reference Not Found.");
        console.log(e);
        errorList = [];
    }

    defineOverrides();
    jasmine.getEnv().specFilter = function() {
        return shouldRunSpec(arguments[0].result);
    }

    function shouldRunSpec(result) {
        let fullName = result.fullName.trim().toLowerCase();
        for (var i = 0; i < errorList.length; i++) {
            if (fullName.indexOf(errorList[i].name) > -1 && fullName.indexOf(errorList[i].suite) > -1)  {
                return true;
            }
        }
        return false;
    }

    function customxit() {
        var spec = global.it.apply(this, arguments);
        spec.disable('Temporarily disabled for errors run');
        return spec;
    }

    function defineOverrides() {
        global.fit = global.it;
        global.fdescribe = global.describe ;
        global.xit = customxit;
    }
};
module.exports = prepare;
