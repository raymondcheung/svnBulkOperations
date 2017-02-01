/**
 * rollback.js "project shortnames" "author email" "which commit to rollback"
 * Example usage: rollback.js "sn_000 sn_001 sn_002" firstname.lastname@email.com 1
 * This will roll back the last commit for the author.  If the second to last to last
 * commit is the one to be rolled back, then 2 should be used instead of 1.
 *
 * Tested and works with NodeJS version 5.7.1
 */
var execSync = require('child_process').execSync,
    fs = require('fs'),
    projectNamesArg= process.argv.slice(2)[0],
    authorName = process.argv.slice(2)[1],
    stepsBackwards = parseInt(process.argv.slice(2)[2]),
    svnFolder = '/tmp/';

var cleanup = function(localSvnDir) {
    console.log('Attempting to clean up: ' + localSvnDir);
    try {
        var cleanOutput = execSync('rm -R ' + localSvnDir);
    } catch(err) {
        console.log('Cleanup failed! ' + localSvnDir + ' was not removed.');
        process.exit(1);
    }
    console.log(cleanOutput.toString());
    console.log(localSvnDir + ' successfully removed.');
}

var diff = function(localSvnDir, commitId) {
    var promise = new Promise(function(resolve, reject) {
        //kick off process
        try {
            var diffOutput = execSync('svn status', {'cwd': localSvnDir}).toString();
        } catch (err) {
            reject(err.message);
        }
        console.log(diffOutput);
        resolve(commitId);
    });
    return promise;
}

var commit = function(localSvnDir, commitId) {
    var promise = new Promise(function(resolve, reject) {
        console.log('Committing...');
        try {
            var child = exec('svn commit' + localSvnDir + ' -m "Rolling back commit for author: "' + authorName + ", commit: " + commitId + '"', {'cwd': localSvnDir});
        } catch (err) {
            reject(err.message);
            console.log("Error occurred during commit.");
        }
        cleanup(localSvnDir);
    });
    return promise;
}

var merge = function(localSvnDir) {
    var promise = new Promise(function(resolve, reject) {
        try {
            var commits = execSync('svn log -q --search="' + authorName + '" --limit=' + (stepsBackwards + 1) + ' | grep -Po "(r[0-9]+)\\s"', {'cwd': localSvnDir}).toString().split("\n");
        } catch(err) {
            reject(err.message);
        }
        var rollbackCommit = commits[stepsBackwards - 1].trim();
        var beforeRollbackCommit = commits[stepsBackwards].trim();

        try {
            var rollbackOutput = execSync('svn merge -r ' + rollbackCommit + ":" + beforeRollbackCommit + " .", {'cwd': localSvnDir}).toString();
        } catch (err) {
            reject(err.message);
        }
        console.log(rollbackOutput);
        resolve(rollbackCommit);
    });
    return promise;
}

var update = function(localSvnDir) {
    var promise = new Promise(function(resolve, reject) {
        var populateFolders = ["assets", "s9ml"];
        for(var folder in populateFolders) {
            console.log("Updating folder " + localSvnDir + "/" + populateFolders[folder]);
            try {
                var updateOutput = execSync('svn update --set-depth infinity ' + localSvnDir + "/" + populateFolders[folder], {'cwd': localSvnDir});
            } catch (err) {
                reject(err.message);
            }
            console.log(updateOutput.toString());
            resolve();
        }
    });
    return promise;
}

var checkout = function(svnProjUrl, localSvnDir) {
    var promise = new Promise(function(resolve, reject) {
        //kick off process
        console.log('svn checkout --depth immediates ' + svnProjUrl + " " + localSvnDir);
        try {
            var checkoutOutput = execSync('svn checkout --depth immediates ' + svnProj + "/trunk " + localSvnDir);
        } catch(err) {
            reject(err.message);
        }
        console.log(checkoutOutput.toString());
        resolve();
    });
    return promise;
};

var rollback = function(svnProjUrl, svnProj) {
    console.log("Starting rollback for project: " + svnProj + "...");

    var localSvnDir = svnFolder + svnProj + "/trunk";
    var failureHandler = function(failureMessage) {
        console.log("rollback failed with message: " + failureMessage);
        process.exit(1);
    };

    checkout(svnProjUrl, localSvnDir).then(function(value){         //checkout succeeded
        return update( localSvnDir);
    }, failureHandler).then(function(value) {       //update succeeded
        return merge( localSvnDir);
    }, failureHandler).then(function(commitId) {    //merge succeeded
        return diff( localSvnDir, commitId);
    }, failureHandler).then(function(commitId) {    //diff succeeded
        return commit(localSvnDir, commitId);
    }, failureHandler).catch(failureHandler);
};

var verifyParam = function(ele, index, arr) {
    if (ele.indexOf("sn_") === -1) {
        console.log("projectNamesArg parameter supplied: " + projectNamesArg + ", is not valid.");
        process.exit(1);
    }
};

if (projectNamesArg.indexOf(" ") !== -1) {
    //multiple project names being passed
    var projectNamesArr = projectNamesArg.split(" ");
    projectNamesArr.forEach(verifyParam);

    for(var index in projectNamesArr) {
        rollback(projectNamesArr[index]);
    }
} else {
    //single project name supplied
    rollback(projectNamesArg);
}