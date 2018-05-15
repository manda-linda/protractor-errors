const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');
const q = require('q');
const m = require('./memory');

function processFiles(reportPathName, ignoreFile, tag) {
    var reportsFilePath = path.join(process.cwd(), reportPathName),
        mostRecentDirectory,
        mostRecentDirectoryStats,
        failedTests = [];
    tag = tag ? '_'+ tag : tag;

    // STEP 1 - READ THROUGH THE DIRECTORIES AND DETERMINE THE MOST RECENT DIRECTORY
    const directories = fs.readdirSync(reportsFilePath);

    // Determines the most recent directory inside jasmine-reports
    for (var i = 0; i < directories.length; i++) {
        const file = directories[i];
        const fullFilePath = path.join(reportsFilePath, file),
            fileStats = fs.statSync(fullFilePath);
        if (fileStats.isFile() || file === ignoreFile || (tag && file.indexOf(tag) !== (file.length - tag.length))) {
            //ignoring;
        } else if (!mostRecentDirectory) {
            mostRecentDirectory = fullFilePath;
            mostRecentDirectoryStats = fileStats;
        } else if (fileStats.birthtime.getTime() > mostRecentDirectoryStats.birthtime.getTime() ) {
            mostRecentDirectory = fullFilePath;
            mostRecentDirectoryStats = fileStats;
        }
    }

    if (!mostRecentDirectory) {
        console.log("no recent protractor runs found");
        throw "no recent protractor runs found";
    } else {
        m.errorsRunOriginDirectory = mostRecentDirectory;
    }

    // STEP 2 - READ AND PARSE THROUGH ALL THE FILES WITHIN THE MOST RECENT DIRECTORY
    const mostRecentFiles = fs.readdirSync(mostRecentDirectory);

    const fullFilePaths = [];
    for (var i = 0; i < mostRecentFiles.length; i++) {
        fullFilePaths.push(path.join(mostRecentDirectory, mostRecentFiles[i]));
    }
    return readXmlFiles(fullFilePaths);

    function readXmlFiles(fullFilePaths) {
        fullFilePaths.map(function(fullFilePath) {
            readXmlFile(fullFilePath);
        });
        return failedTests;
    }

    function readXmlFile(fullFilePath) {
        const fileContents = fs.readFileSync(fullFilePath);

        return parseXmlFileContents(fileContents);
    }

    function parseXmlFileContents(fileContents) {

        xml2js.parseString(fileContents, function(err, result) {
            if (err) {
                console.log("Failed to parse xml file contents");
                throw "Failed to parse xml file contents";
            }

            const testSuiteArray = result.testsuites.testsuite;
            if (testSuiteArray) {
                for (var i = 0; i < testSuiteArray.length; i++) {
                    const testCaseArray = testSuiteArray[i].testcase;
                    if (testCaseArray) {
                        for (var j = 0; j < testCaseArray.length; j++) {
                            const testCase = testCaseArray[j];
                            if (testCase.failure) {
                                failedTests.push({
                                    suite: testCase.$.classname.trim().toLowerCase().replace(' .','  '),
                                    name: testCase.$.name.trim().toLowerCase()
                                });
                            }
                        }
                    }
                }
            }
        });
    }
}

module.exports = processFiles;
