const glob = require('glob');
const fs = require('fs');
const argv = require('minimist')(process.argv.slice(2));
const processFiles = require('./file-processor.js');

function configFilter(config) {

    const filteredConfig = Object.assign({}, config);
    const options = {};

    // Extend the defaults in the config
    const defaultParams = config.params;

    // Get argument parameters
    const browser = argv;
    const definedParams = Object.assign({}, defaultParams, argv.params);
    browser.params = definedParams;

    if (!browser.params.errorsRun || !(browser.params.errorsRun === 'true' || browser.params.errorsRun === 'True')) {
        return filteredConfig;
    }

    // Find the most recent directorty inside errorsPath
    try {
        var errorList = browser.params.errorsList || processFiles(browser.params.errorsPath, null, browser.params.errorsTag);
    } catch (e) {
        console.log("Previous errors reference not found.");
        console.log(e);
        errorList = [];
    }

    const errorSuiteDict = {};
    errorList.forEach(function(error) {
        let suite = normalizeSuite(error.suite);
        errorSuiteDict[suite] = true;
    });

    if (filteredConfig.suites[browser.suite] && browser.params.errorsRun) {
        const filteredSuites = [];
        const suite = filteredConfig.suites[browser.suite];
        const regex = /describe\(\'(.*)\'/i;

        suite.forEach(function(filepathGlob) {
            const files = glob.sync(filepathGlob, options);

            files.forEach(function(file) {
                // Read the file contents, if the parent suite matches the errorList
                const contents = fs.readFileSync(file, 'utf8');
                const match = contents.match(regex);
                if (match.length > 0 && errorSuiteDict[normalizeSuite(match[1])]) {
                    filteredSuites.push(file);
                }
            });

        });

        filteredConfig.suites[browser.suite] = filteredSuites;
    }

    return filteredConfig;
}

function normalizeSuite(suite) {
    if (suite) return suite.split('-')[0].trim().toLowerCase();
}

module.exports = configFilter;
