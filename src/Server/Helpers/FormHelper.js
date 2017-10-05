'use strict';

const DatabaseHelper = require('Server/Helpers/DatabaseHelper');
const SyncHelper = require('Server/Helpers/SyncHelper');

const Form = require('Common/Models/Form');

/**
 * The helper class for Forms
 *
 * @memberof HashBrown.Server.Helpers
 */
class FormHelper {
    /**
     * Gets Form by id
     *
     * @param {String} project
     * @param {String} environment
     * @param {String} id
     *
     * @returns {Promise} Form
     */
    static getForm(
        project = requiredParam('project'),
        environment = requiredParam('environment'),
        id = requiredParam('id')
    ) {
        let collection = environment + '.forms';
    
        return DatabaseHelper.findOne(
            project,
            collection,
            {
                id: id
            }
        )
        .then((result) => {
            if(!result) {
                return SyncHelper.getResourceItem(project, environment, 'forms', id);
            }

            return Promise.resolve(result);
        })
        .then((result) => {
            return Promise.resolve(new Form(result));
        });
    }
    
    /**
     * Deletes Form by id
     *
     * @param {String} project
     * @param {String} environment
     * @param {String} id
     *
     * @returns {Promise} Promise
     */
    static deleteForm(
        project = requiredParam('project'),
        environment = requiredParam('environment'),
        id = requiredParam('id')
    ) {
        let collection = environment + '.forms';
    
        return DatabaseHelper.removeOne(
            project,
            collection,
            {
                id: id
            }
        );
    }

    /**
     * Gets all Forms
     *
     * @param {String} project
     * @param {String} environment
     *
     * @returns {Promise} Array of forms
     */
    static getAllForms(
        project = requiredParam('project'),
        environment = requiredParam('environment')
    ) {
        let collection = environment + '.forms';
        
        return DatabaseHelper.find(
            project,
            collection,
            {}
        )
        .then((results) => {
            return SyncHelper.mergeResource(project, environment, 'forms', results); 
        });
    }
    
    /**
     * Sets a Form by id
     *
     * @param {String} project
     * @param {String} environment
     * @param {String} id
     * @param {Object} properties
     * @param {Boolean} create
     *
     * @returns {Promise} Form
     */
    static setForm(
        project = requiredParam('project'),
        environment = requiredParam('environment'),
        id = requiredParam('id'),
        properties = requiredParam('properties'),
        create = true
    ) {
        let collection = environment + '.forms';

        // Unset automatic flags
        properties.isLocked = false;

        properties.sync = {
            isRemote: false,
            hasRemote: false
        };
        
        return DatabaseHelper.updateOne(
            project,
            collection,
            {
                id: id
            },
            properties,
            {
                upsert: create
            }
        )
        .then(() => {
            return Promise.resolve(new Form(properties));
        });
    }

    /**
     * Creates a new Form
     *
     * @param {String} project
     * @param {String} environment
     *
     * @returns {Promise} Form
     */
    static createForm(
        project = requiredParam('project'),
        environment = requiredParam('environment')
    ) {
        let form = Form.create();
        let collection = environment + '.forms';

        return DatabaseHelper.insertOne(
            project,
            collection,
            form.getObject()
        )
        .then(() => {
            return Promise.resolve(form);
        });
    }

    /**
     * Adds an entry by to a Form by id
     *
     * @param {String} project
     * @param {String} environment
     * @param {String} id
     * @param {Object} entry
     *
     * @returns {Promise} Promise
     */
    static addEntry(
        project = requiredParam('project'),
        environment = requiredParam('environment'),
        id = requiredParam('id'),
        entry = requiredParam('entry')
    ) {
        return this.getForm(project, environment, id)
        .then((form) => {
            form.addEntry(entry);

            return this.setForm(project, environment, id, form.getObject())
        });
    }

    /**
     * Clears all entries in a Form by id
     *
     * @param {String} project
     * @param {String} environment
     * @param {String} id
     *
     * @returns {Promise} Promise
     */
    static clearAllEntries(
        project = requiredParam('project'),
        environment = requiredParam('environment'),
        id = requiredParam('id')
    ) {
        return this.getForm(project, environment, id)
        .then((form) => {
            form.clearAllEntries();

            return this.setForm(project, environment, id, form.getObject())
        });
    }
}

module.exports = FormHelper;