var xml2js = require('xml2js');
var fs = require('fs');
var path = require('path');
var q = require('q');

function processFiles(reportPathName, ignoreFile, tag) {
    var reportsFilePath = path.join(process.cwd(), reportPathName),
        mostRecentDirectory,
        mostRecentDirectoryStats,
        failedTests = [];
        tag = tag ? '_'+ tag : tag;

        // STEP 1 - READ THROUGH THE DIRECTORIES AND DETERMINE THE MOST RECENT DIRECTORY
        var directories = fs.readdirSync(reportsFilePath);

        // Determines the most recent directory inside jasmine-reports
        for (var i = 0; i < directories.length; i++) {
            var file = directories[i];
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
        }

        // STEP 2 - READ AND PARSE THROUGH ALL THE FILES WITHIN THE MOST RECENT DIRECTORY
        var mostRecentFiles = fs.readdirSync(mostRecentDirectory);

        var fullFilePaths = [];
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
            var fileContents = fs.readFileSync(fullFilePath);

            return parseXmlFileContents(fileContents);
        }

        function parseXmlFileContents(fileContents) {

            xml2js.parseString(fileContents, function(err, result) {
                if (err) {
                    console.log("Failed to parse xml file contents");
                    throw "Failed to parse xml file contents";
                }

                var testSuiteArray = result.testsuites.testsuite;
                if (testSuiteArray) {
                    for (var i = 0; i < testSuiteArray.length; i++) {
                        var testCaseArray = testSuiteArray[i].testcase;
                        if (testCaseArray) {
                            for ( var j = 0; j < testCaseArray.length; j++) {
                                var testCase = testCaseArray[j];
                                if (testCase.failure) {
                                    failedTests.push({
                                        suite: result.testsuites.testsuite[0].$.name,
                                        classname: testCase.$.classname.trim().toLowerCase().replace(' .','  '),
                                        name: testCase.$.name.trim().toLowerCase()
                                    });
                                }
                            }
                        }
                    }
                }
            });
        }
};

module.exports = processFiles;