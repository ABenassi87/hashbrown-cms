'use strict';

const Path = require('path');
const FileSystem = require('fs');
const RimRaf = require('rimraf');
const Multer = require('multer');

const Media = require('Server/Models/Media');
const DatabaseHelper = require('Server/Helpers/DatabaseHelper');
const SyncHelper = require('Server/Helpers/SyncHelper');

const MediaHelperCommon = require('Common/Helpers/MediaHelper');

/**
 * The helper class for Media
 *
 * @memberof HashBrown.Server.Helpers
 */
class MediaHelper extends MediaHelperCommon {
    /**
     * Gets the upload handler
     *
     * @param {Boolean} isSingleFile
     *
     * @return {Function} handler
     */
    static getUploadHandler(isSingleFile) {
        let handler = Multer({
            storage: Multer.diskStorage({
                destination: (req, file, resolve) => {
                    let path = MediaHelper.getTempPath(req.project);
                   
                    debug.log('Handling file upload to temp storage...', this);

                    if(!FileSystem.existsSync(path)){
                        this.mkdirRecursively(path, () => {
                            resolve(null, path);
                        });
                    
                    } else {
                        resolve(null, path);

                    }
                },
                filename: (req, file, resolve) => {
                    resolve(null, file.originalname);
                }
            })
        })
       
        if(isSingleFile) {
            return handler.single('media');
        } else {
            return handler.array('media', 100);
        }
    }

    /**
     * Makes a directory recursively
     *
     * @param {String} dirPath
     * @param {Function} callback
     * @param {Number} position
     */
    static mkdirRecursively(dirPath, callback = null, position = 0) {
        checkParam(dirPath, 'dirPath', String);
        
        let parts = Path.normalize(dirPath).split(Path.sep);
        
        if(position >= parts.length) {      
            if(callback) {
                callback();
            }
            
            return;
        }
        
        let currentDirPath = parts.slice(0, position + 1).join(Path.sep);
          
        if(currentDirPath) {
            if(!FileSystem.existsSync(currentDirPath)) {
                FileSystem.mkdirSync(currentDirPath);
            }
        }
        
        MediaHelper.mkdirRecursively(dirPath, callback, position + 1);
    }
    
    /**
     * Sets a Media object
     *
     * @param {Number} id
     * @param {Object} file
     *
     * @return {Promise} promise
     */
    static setMediaData(id, file) {
        checkParam(id, 'id', Number);
        checkParam(file, 'file', Object);

        return new Promise((resolve, reject) => {
            let oldPath = file.path;
            let name = Path.basename(oldPath);
            let newDir = this.getMediaPath() + id;
            let newPath = newDir + '/' + name;

            debug.log('Setting media data at "' + newPath + '"...', this);

            // First check if the given directory exists
            // If it doesn't, create it with parents recursively
            if(!FileSystem.existsSync(newDir)){
                this.mkdirRecursively(newDir, (err) => {
                    if(err) {
                        reject(new Error(err));
                    
                    } else {
                        // Move the temp file to the new path
                        FileSystem.rename(oldPath, newPath, function(err) {
                            if(err) {
                                reject(new Error(err));
                            
                            } else {
                                resolve();

                            }
                        });
                    
                    }
                });

            // If it does exist, remove the directory
            } else {
                RimRaf(newDir, (err) => {
                    if(err) {
                        reject(new Error(err));
                    
                    } else {
                        // Move the temp file to the new path
                        FileSystem.rename(oldPath, newPath, function(err) {
                            if(err) {
                                reject(new Error(err));
                            
                            } else {
                                resolve();

                            }
                        });
                    
                    }
                });
            }

        });
    }

    /**
     * Uploads a file from temp storage
     *
     * @param {String} project
     * @param {String} environment
     * @param {String} id
     * @param {String} tempPath
     *
     * @returns {Promise} Result
     */
    static uploadFromTemp(project, environment, id, tempPath) {
        checkParam(project, 'project', String);
        checkParam(environment, 'environment', String);
        checkParam(id, 'id', String);
        checkParam(tempPath, 'tempPath', String);

        let connection;
        let filename = Path.basename(tempPath);

        // Get Media provider
        return HashBrown.Helpers.ConnectionHelper.getMediaProvider(project, environment)
        .then((provider) => {
            connection = provider;

            // Read the file from temp
            debug.log('Reading file from temp dir ' + tempPath + '...', this);

            return new Promise((resolve, reject)  => {
                FileSystem.readFile(tempPath, (err, fileData) => {
                    if(err) { return reject(err); }

                    resolve(fileData);
                });
            });
        })
        .then((fileData) => {
            // Upload the data
            debug.log('Uploading file...', this);
            
            return connection.setMedia(id, filename, fileData.toString('base64'));
        })
        .then(() => {
            // Remove the file from temp storage
            debug.log('Removing temp file...', this);
            
            return new Promise((resolve, reject)  => {
                FileSystem.unlink(tempPath, (err) => {
                    resolve();
                });
            });
        });
    }

    /**
     * Gets the Media tree
     *
     * NOTE:
     * This method, as opposed to most other resource methods, does not merge
     * local and remote resources since it would be too complicated in the end
     *
     * @param {String} project
     * @param {String} environment
     *
     * @return {Promise} Tree
     */
    static getTree(project, environment) {
        checkParam(project, 'project', String);
        checkParam(environment, 'environment', String);

        let collection = environment + '.media';
       
        return SyncHelper.getResource(project, environment, 'media/tree')
        .then((tree) => {
            if(!tree || tree.length < 1) {
                return DatabaseHelper.find(project, environment + '.media', {});
            }

            return Promise.resolve(tree);   
        })
        .then((tree) => {
            // Make sure there is a root folder
            tree.unshift({folder: '/', id: '*'});

            // Path sanity check
            for(let item of tree) {
                item.folder = item.folder || '/'; 

                // Append initial slash
                if(item.folder.indexOf('/') !== 0) {
                    item.folder = '/' + item.folder;
                }

                // Append end slash
                item.folder = item.folder + '/';

                // Replace all double slashes with a single slash
                item.folder = item.folder.replace(/\/+/g, '/');
            }

            return Promise.resolve(tree);
        });
    }
    
    /**
     * Sets a Media tree parent
     *
     * @param {String} project
     * @param {String} environment
     * @param {String} id
     * @param {Object} item
     *
     * @return {Promise} promise
     */
    static setTreeItem(project, environment, id, item) {
        checkParam(project, 'project', String);
        checkParam(environment, 'environment', String);
        checkParam(id, 'id', String);
        checkParam(item, 'item', Object);

        return SyncHelper.setResourceItem(project, environment, 'media/tree', id, item)
        .then((wasItemSet) => {
            if(wasItemSet) { return Promise.resolve(); }        

            // Remove the item if it's null
            if(!item) {
                return DatabaseHelper.removeOne(
                    project,
                    environment + '.media',
                    {
                        id: id
                    }
                );

            // If it's not, update the database document
            } else {
                item.id = id;

                return DatabaseHelper.updateOne(
                    project,
                    environment + '.media',
                    {
                        id: id
                    },
                    item,
                    {
                        upsert: true
                    }
                );
            }
        })
    }
    
    /**
     * Gets the media temp path
     *
     * @param {String} project
     *
     * @returns {String} path
     */
    static getTempPath(project) {
        checkParam(project, 'project', String);

        return Path.join(APP_ROOT, 'storage', project, 'temp');
    }
}

module.exports = MediaHelper;
