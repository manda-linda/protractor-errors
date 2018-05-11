const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const m = require('./memory');
const xmlArray = it => (Array.isArray(it) ? it : [it]).filter(Boolean);

/**
 *
 * The amend function merges the original run data into the new (errors) run, so that
 * any tests that were not run in the errors run will not be dropped from future runs.
 *
 @example

 Report 1: 350 tests / 50 errors
 Report 2: 48 tests / 10 errors
 Report 3: 9 tests / 1 error

 Normally this would be a case of losing information about 3 tests having been left out
 of their respective incremental errors runs.

 With "amend", the entire body of the `origin` run is carried over to your current `errors` run,
 amended only by the actual tests that ran. It would potentially look like this:

 Report 1: 350 tests / 50 errors (350 run)
 Report 2: 350 tests / 12 errors (48 run)
 Report 3: 350 tests / 4 errors (9 run)
 *
 * The 3 errors that were previously being dropped out are preserved so you
 * can continue running those errors.
 *
 */
module.exports = function () {
    if (!browser || !browser.params || !jasmine  || !browser.params.currentTime) {
        console.error('Missing browser.params required for protractor-errors amend.');
        return;
    }

    const directoryName = browser.params.errorsTag ? browser.params.currentTime + '_' + browser.params.errorsTag : browser.params.currentTime;

    if (String(browser.params.errorsRun).toLowerCase() !== 'true') {
        return;
    }

    try {
        return amend(browser.params.errorsPath, directoryName, browser.params.errorsTag);
    } catch (e) {
        console.log(e);
    }
};

async function amend(reportPathName, ignoreFile, tag) {

    const reportsFilePath = path.join(process.cwd(), reportPathName);

    // STEP 1 - READ THROUGH THE DIRECTORIES AND DETERMINE THE MOST RECENT 2 DIRECTORIES
    const directories = fs.readdirSync(reportsFilePath).sort((a, b) => {
        const [left, right] = [a, b].map(f => {
            const fullFilePath = path.join(reportsFilePath, f),
                fileStats = fs.statSync(fullFilePath);
            if (fileStats.isFile()) {
                return 0;
            }
            return fileStats.birthtime.getTime();
        });
        return left - right;
    });

    const [mostRecentDirectory, secondMostRecentDirectory] = [
        path.join(reportsFilePath, directories.pop()),
        m.errorsRunOriginDirectory
    ];

    if (!mostRecentDirectory || !secondMostRecentDirectory || (mostRecentDirectory === secondMostRecentDirectory)) {
        const message = 'At least two protractor runs are needed.';
        console.log(message);
        throw new Error(message);
    }

    // STEP 2 - Combine run 1 and run 2 information to rewrite run 2's report.
    try {
        const run1 = readXmlFiles(fs.readdirSync(secondMostRecentDirectory).map(file => {
            return path.join(secondMostRecentDirectory, file);
        }), secondMostRecentDirectory);
        const run2 = readXmlFiles(fs.readdirSync(mostRecentDirectory).map(file => {
            return path.join(mostRecentDirectory, file);
        }), mostRecentDirectory);

        await amendWrite(run1, run2, secondMostRecentDirectory, mostRecentDirectory);

    } catch (e) {
        console.error(e);
    }

}

function readXmlFiles(fullFilePaths, directoryName) {
    const output = {};
    fullFilePaths.forEach(function (fullFilePath) {
        const relativeFilePath = fullFilePath.slice(fullFilePath.indexOf(directoryName) + directoryName.length + 1);
        output[relativeFilePath] = {
            fullFilePath,
            contents: readXmlFile(fullFilePath)
        }
    });
    return output;
}

/**
 * @returns {Promise}
 */
function readXmlFile(fullFilePath) {
    const fileContents = fs.readFileSync(fullFilePath);
    return parseXmlFileContents(fileContents);
}

/**
 * @returns {Promise}
 */
function parseXmlFileContents(fileContents) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(fileContents, function (err, result) {
            if (err) {
                console.log("Failed to parse xml file contents");
                return reject(err);
            }
            return resolve(result);
        });
    })
}

/**
 * @param run1 - key is suite filename, common between runs, value is an object with contents field (parsed xml object).
 * @param run2 - same structure as run1 but different absolute path.
 * @param previousRunDirectory
 * @param latestRunDirectory
 *
 * Run 2 is the one that just finished.
 */
async function amendWrite(run1, run2, previousRunDirectory, latestRunDirectory) {
    for (const key in run1) {

        const suiteA = run1[key];
        const suiteB = run2[key];

        if (!suiteB || !suiteB.contents) { // nothing to amend
            continue;
        }

        const testSuiteArrayA = xmlArray((await suiteA.contents).testsuites.testsuite);
        const testSuiteArrayB = xmlArray((await suiteB.contents).testsuites.testsuite);

        const getSuite = testcase => testcase.$.classname.trim().toLowerCase().replace(' .','  ');
        const getSpec = testcase => testcase.$.name.trim().toLowerCase();

        const findCase = (suite, spec, inGroup = testSuiteArrayB) => {
            var matchedSuite;
            for (const haystackSuite of xmlArray(inGroup)) {
                for (const testcase of xmlArray(haystackSuite.testcase)) {

                    const _suite = getSuite(testcase);
                    const _spec = getSpec(testcase);

                    if (suite === _suite) {
                        matchedSuite = suite;
                        if (spec === _spec) {
                            return [testcase, haystackSuite]
                        }
                    }
                }
            }
            return [undefined, matchedSuite];
        };

        // merge A into B, preferring values from B (newer).
        // in memory only. The write operation will be to B.
        for (const suiteObject of testSuiteArrayA || []) {
            const it = suiteObject.testcase || [];
            for (var i = 0; i < it.length; ++i) {
                const testcase = it[i];
                const suite = getSuite(testcase);
                const spec = getSpec(testcase);

                const [counterpart] = findCase(suite, spec);

                if (!testcase.failure) { // Only amending existing failures.
                    continue;
                }

                if (!counterpart) { // nothing to amend.
                    continue;
                }

                if (counterpart.failure) { // failed again, overwrite this case's failure.
                    testcase.failure = counterpart.failure;
                    continue;
                }

                // the test passed in the errors run

                if (counterpart.skipped) {
                    if (!testcase.skipped) {
                        suiteObject.$.skipped += 1;
                    }
                    continue;
                }

                it[i] = counterpart;
                suiteObject.$.failures -= 1;

            }
        }
    }

    for (const xmlSuiteFileName in run1) {
        if (!run1.hasOwnProperty(xmlSuiteFileName)) {
            continue;
        }
        const fileObject = run1[xmlSuiteFileName];

        if (!fileObject) {
            return;
        }
        const builder = new xml2js.Builder();
        const xml = builder.buildObject(await fileObject.contents);
        const targetFile = fileObject.fullFilePath.replace(previousRunDirectory, latestRunDirectory);
        fs.writeFileSync(targetFile, xml);
    }

    return 0;
}
