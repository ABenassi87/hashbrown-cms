'use strict';

const ChildProcess = require('child_process');
const ZLib = require('zlib');
const Path = require('path');
const FileSystem = require('fs');
const SemanticVersion = require('semver');

const RequestHelper = require('Server/Helpers/RequestHelper');


/**
 * The helper class for system updates
 *
 * @memberof HashBrown.Server.Helpers
 */
class UpdateHelper {
    /**
     * Check for updates
     *
     * @returns {Promise} Status info
     */
    static check() {
        return RequestHelper.request('get', 'https://api.github.com/repos/Putaitu/hashbrown-cms/releases/latest')
        .then((res) => {
            if(!res || !res.tag_name) {
                return Promise.reject(new Error('Couldn\'t fetch update information'));
            }

            // Compare local and remote version numbers
            let remoteVersion = res.tag_name;
            let localVersion = require(appRoot + '/package.json').version;

            return Promise.resolve({
                isBehind: this.isVersionBehind(localVersion, remoteVersion),
                remoteVersion: remoteVersion,
                localVersion: localVersion,
                comment: res.body
            });
        });
    }
   
    /**
     * Checks if version a is behind version b
     *
     * @param {String} a
     * @param {String} b
     *
     * @returns {Boolean} Whether version a is behind version b
     */
    static isVersionBehind(a, b) {
        a = a.replace('v', '');
        b = b.replace('v', '');

        if(!SemanticVersion.valid(a) || !SemanticVersion.valid(b)) {
            throw new Error('Couldn\'t compare version numbers');
        }

        return SemanticVersion.lt(a, b);
    }

    /**
     * Perform update
     *
     * @returns {Promise} Status info
     */
    static update() {
        debug.log('Updating HashBrown...', this);
        
        // Get latest release info
        return RequestHelper.request('get', 'https://api.github.com/repos/Putaitu/hashbrown-cms/releases/latest')
        
        // Check versions
        .then((res) => {
            let remoteVersion = res.tag_name;
            let localVersion = require(appRoot + '/package.json').version;

            if(!this.isVersionBehind(localVersion, remoteVersion)) {
                return Promise.reject(new Error('Can\'t update, local version is not behind remote version'));
            }

            return Promise.resolve();
        })
        
        // Git checkout stable
        // NOTE: When the user is upgrading through the UI, they should be on stable
        .then(() => {
            debug.log('Checking out stable branch...', this);

            return new Promise((resolve, reject) => {
                let git = exec('git checkout stable', {
                    cwd: appRoot
                });

                git.stdout.on('data', (data) => {
                    debug.log(data, this, 3);
                });

                git.stderr.on('data', (data) => {
                    debug.log(data, this, 3);
                });

                git.on('exit', (code) => {
                    if(code == 0 || code == '0') {
                        resolve();
                    } else {
                        reject(new Error('Failed to check out the "stable" branch with GIT'));
                    }
                });
            })
        })

        // Git pull
        .then((res) => {
            debug.log('Pulling update from GitHub...', this);
            
            return new Promise((resolve, reject) => {
                let git = exec('git pull origin stable', {
                    cwd: appRoot
                });

                git.stdout.on('data', (data) => {
                    debug.log(data, this, 3);
                });

                git.stderr.on('data', (data) => {
                    debug.log(data, this, 3);
                });

                git.on('exit', (code) => {
                    if(code == 0 || code == '0') {
                        resolve();
                    } else {
                        reject(new Error('Update failed while trying to run "git pull"'));
                    }
                });
            })
        })

        // Install dependencies
        .then(() => {
            debug.log('Installing dependencies...', this);
            
            return new Promise((resolve, reject) => {
                let npm = ChildProcess.exec('rm -rf node_modules && npm install --production', {
                    cwd: appRoot
                });

                npm.stdout.on('data', (data) => {
                    debug.log(data, this, 3);
                });

                npm.stderr.on('data', (data) => {
                    debug.log(data, this, 3);
                });
                
                npm.on('exit', (code) => {
                    code = parseInt(code);

                    if(code === 0) {
                        resolve();
                    } else {
                        reject(new Error('Install failed while trying to run "npm install"'));
                    }
                });
            });
        });
    }
}

module.exports = UpdateHelper;