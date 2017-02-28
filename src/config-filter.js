var glob = require('glob');
var fs = require('fs');
var argv = require('minimist')(process.argv.slice(2));
var processFiles = require('./file-processor.js');

function configFilter(config) {

    var filteredConfig = Object.assign({}, config);
    var options = {};

    // Extend the defaults in the config
    var defaultParams = config.params;

    // Get argument parameters
    var browser = argv;
    var definedParams = Object.assign({}, defaultParams, argv.params);
    browser.params = definedParams;

    if (!browser.params.errorsRun || !(browser.params.errorsRun === 'true' || browser.params.errorsRun === 'True')) {
        return filteredConfig;
    }

    // Find the most recent directorty inside errorsPath
    try {
        errorList = processFiles(browser.params.errorsPath, null, browser.params.errorsTag);
    } catch (e) {
        console.log("Previous errors reference not found.");
        console.log(e);
        errorList = [];
    }

    var errorSuiteDict = {};
    errorList.forEach(function(error) {
        errorSuiteDict[error.suite] = true;
    });

    if (filteredConfig.suites[browser.suite] && browser.params.errorsRun) {
        var filteredSuites = [];
        var suite = filteredConfig.suites[browser.suite];
        var regex = /describe\(\'(.*)\'/i;

        suite.forEach(function(filepathGlob) {
            var files = glob.sync(filepathGlob, options);

            files.forEach(function(file) {
                // Read the file contents, if the parent suite matches the errorList
                var contents = fs.readFileSync(file, 'utf8');
                var match = contents.match(regex);
                if (match.length > 0 && errorSuiteDict[match[1]]) {
                    filteredSuites.push(file);
                }
            });

        });

        filteredConfig.suites[browser.suite] = filteredSuites;
    }

    return filteredConfig;
}

module.exports = configFilter;