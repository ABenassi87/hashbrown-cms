'use strict';

let Pane = require('./Pane');

class ContentPane extends Pane {
    /**
     * Event: Click copy content
     */
    static onClickCopyContent() {
        let navbar = ViewHelper.get('NavbarMain');
        let id = $('.context-menu-target-element').data('id');

        // Event when pasting the copied Content
        this.onClickPasteContent = function onClickPasteContent() {
            let parentId = $('.context-menu-target-element').data('id');
            let newContentId;
          
            // API call to get copied Content model 
            apiCall('get', 'content/' + id)

            // Remove the id and call the API to create a new Content node
            .then((copiedContent) => {
                delete copiedContent['id'];

                return apiCall('post', 'content/new/' + copiedContent.schemaId + '?parent=' + parentId, copiedContent.properties);
            })

            // Upon success, reload all Content models
            .then((newContent) => {
                newContentId = newContent.id;

                return reloadResource('content');
            })

            // Reload the UI
            .then(() => {
                navbar.reload();
                navbar.onClickPasteContent = null;

                location.hash = '/content/' + newContentId; 
            })
            .catch(UI.errorModal);
        }
    }
    
    /**
     * Event: Click pull content
     */
    static onClickPullContent() {
        let navbar = ViewHelper.get('NavbarMain');
        let contentEditor = ViewHelper.get('ContentEditor');
        let pullId = $('.context-menu-target-element').data('id');

        // API call to pull the Content by id
        apiCall('post', 'content/pull/' + pullId, {})
        
        // Upon success, reload all Content models    
        .then(() => {
            return reloadResource('content');
        })

        // Reload the UI
        .then(() => {
            navbar.reload();

            if(contentEditor && contentEditor.model.id == pullId) {
                contentEditor.model = null;
                contentEditor.fetch();
            }
        }) 
        .catch(UI.errorModal);
    }
    
    /**
     * Event: Click push content
     */
    static onClickPushContent() {
        let navbar = ViewHelper.get('NavbarMain');
        let pushId = $('.context-menu-target-element').data('id');

        // API call to push the Content by id
        apiCall('post', 'content/push/' + pushId)

        // Upon success, reload all Content models
        .then(() => {
            return reloadResource('content');
        })

        // Reload the UI
        .then(() => {
            navbar.reload();
        }) 
        .catch(UI.errorModal);
    }

    /**
     * Event: Click cut content
     */
    static onClickCutContent() {
        let navbar = ViewHelper.get('NavbarMain');
        let cutId = $('.context-menu-target-element').data('id');

        // Event when pasting the cut content
        this.onClickPasteContent = function onClickPasteContent() {
            let parentId = $('.context-menu-target-element').data('id');
           
            // Get the Content model
            ContentHelper.getContentById(cutId)

            // API call to apply changes to Content parent
            .then((cutContent) => {
                cutContent.parentId = parentId;
              
                return apiCall('post', 'content/' + cutId, cutContent);
            })

            // Reload all Content models
            .then(() => {
                return reloadResource('content');
            })

            // Reload UI
            .then(() => {
                navbar.reload();
                navbar.onClickPasteContent = null;

                location.hash = '/content/' + cutId;
            })
            .catch(UI.errorModal);
        }
    }

    /**
     * Event: Click new content
     *
     * @param {String} parentId
     */
    static onClickNewContent(parentId) {
        let navbar = ViewHelper.get('NavbarMain');

        // Try to get a parent Schema if it exists
        return function getParentSchema() {
            if(parentId) {
                return ContentHelper.getContentById(parentId)
                .then((parentContent) => {
                    return SchemaHelper.getSchemaById(parentContent.schemaId);
                });
            } else {
                return Promise.resolve();
            }
        }()

        // Parent Schema logic resolved, move on
        .then((parentSchema) => {
            let allowedSchemas = parentSchema ? parentSchema.allowedChildSchemas : null;

            // If allowed child Schemas were found, but none were provided, don't create the Content node
            if(allowedSchemas && allowedSchemas.length < 1) {
                return Promise.reject(new Error('No child content schemas are allowed under this parent'));
            
            // Some child Schemas were provided, or no restrictions were defined
            } else {
                let schemaId;
                
                // Instatiate a new Content Schema reference editor
                let schemaReference = new resources.editors.contentSchemaReference({
                    config: {
                        allowedSchemas: allowedSchemas,
                        parentSchema: parentSchema
                    }
                });

                schemaReference.on('change', (newValue) => {
                    schemaId = newValue;
                });

                // Render the confirmation modal
                UI.confirmModal(
                    'OK',
                    'Create new content',
                    _.div({},
                        _.p('Please pick a schema'),
                        schemaReference.$element
                    ),

                    // Event fired when clicking "OK"
                    () => {
                        if(!schemaId) { return false; }
                       
                        let apiUrl = 'content/new/' + schemaId;
                        let newContent;

                        // Append parent Content id to request URL
                        if(parentId) {
                            apiUrl += '?parent=' + parentId;
                        }

                        // API call to create new Content node
                        apiCall('post', apiUrl)
                        
                        // Upon success, reload resource and UI elements    
                        .then((result) => {
                            newContent = result;

                            return reloadResource('content');
                        })
                        .then(() => {
                            navbar.reload();
                            
                            location.hash = '/content/' + newContent.id;
                        })
                        .catch(UI.errorModal);
                    }
                );
            }
        })
        .catch(UI.errorModal);
    }

    /**
     * Render Content publishing modal
     *
     * @param {Content} content
     * @param {Object} publishing
     */
    static renderContentPublishingModal(content, publishing) {
        // Event on clicking OK
        function onSubmit() {
            if(!publishing.governedBy) {
                publishing.connections = [];
               
                // Loop through each input switch and add the corresponding Connection id to the connections list 
                modal.$element.find('.switch[data-connection-id] input').each(function(i) {
                    if(this.checked) {
                        publishing.connections.push(
                            this.parentElement.dataset.connectionId
                        );
                    }
                });
                
                // Apply to children flag
                publishing.applyToChildren = modal.$element.find('#switch-publishing-apply-to-children input')[0].checked;

                // Commit publishing settings to Content model
                content.settings.publishing = publishing;
        
                // API call to save the Content model
                apiCall('post', 'content/' + content.id, content)
                
                // Upon success, reload the UI    
                .then(() => {
                    NavbarMain.reload();

                    if(Router.params.id == content.id) {
                        let contentEditor = ViewHelper.get('ContentEditor');

                        contentEditor.model = content.getObject();
                        return contentEditor.render();
                    
                    } else {
                        return Promise.resolve();

                    }
                })
                .catch(UI.errorModal);
            }

        }
        
        let modal = new MessageModal({
            model: {
                title: 'Publishing settings for "' + content.prop('title', window.language) + '"'
            },
            buttons: [
                {
                    label: 'Cancel',
                    class: 'btn-default'
                },
                {
                    label: 'OK',
                    class: 'btn-primary',
                    callback: () => {
                        onSubmit();
                    }
                }
            ],
            renderBody: () => {
                if(publishing.governedBy) {
                    return _.div({class: 'settings-publishing'},
                        _.p('(Settings inherited from <a href="#/content/' + publishing.governedBy.id + '">' + publishing.governedBy.prop('title', window.language) + '</a>)')
                    );
                
                } else {
                    return _.div({class: 'settings-publishing'},
                        // Apply to children switch
                        _.div({class: 'input-group'},      
                            _.span('Apply to children'),
                            _.div({class: 'input-group-addon'},
                                UI.inputSwitch(publishing.applyToChildren == true).attr('id', 'switch-publishing-apply-to-children')
                            )
                        ),

                        // Connections list
                        _.each(window.resources.connections, (i, connection) => { 
                            return _.div({class: 'input-group'},      
                                _.span(connection.title),
                                _.div({class: 'input-group-addon'},
                                    UI.inputSwitch(publishing.connections.indexOf(connection.id) > -1).attr('data-connection-id', connection.id)
                                )
                            );
                        })
                    );
                }
            }
        });

        modal.$element.toggleClass('settings-modal content-settings-modal');
    }

    /**
     * Event: Click Content settings
     */
    static onClickContentPublishing() {
        let id = $('.context-menu-target-element').data('id');
        let navbar = ViewHelper.get('NavbarMain');
        let content;

        // Get Content model
        ContentHelper.getContentById(id)
        .then((result) => {
            content = result;

            if(!content) {
                return Promise.reject(new Error('Couldn\'t find content with id "' + id + '"')); 

            } else {
                // Get settings first
                return content.getSettings('publishing');
            }
        })
        
        // Upon success, render Content settings modal
        .then((publishing) => {
            // Sanity check
            publishing.applyToChildren = publishing.applyToChildren == true || publishing.applyToChildren == 'true';

            this.renderContentPublishingModal(content, publishing);
        });
    }

    /**
     * Event: Click remove content
     *
     * @param {Boolean} shouldUnpublish
     */
    static onClickRemoveContent(shouldUnpublish) {
        let navbar = ViewHelper.get('NavbarMain');
        let id = $('.context-menu-target-element').data('id');
        let name = $('.context-menu-target-element').data('name');
       
        ContentHelper.getContentById(id)
        .then((content) => {
            content.getSettings('publishing')
            .then((publishing) => {
                function unpublishConnections() {
                    return apiCall('post', 'content/unpublish', content)
                    .then(() => {
                        return onSuccess();
                    });
                }
                
                function onSuccess() {
                    return reloadResource('content')
                    .then(() => {
                        navbar.reload();
                                
                        let contentEditor = ViewHelper.get('ContentEditor');
                       
                        // Change the ContentEditor view if it was displaying the deleted content
                        if(contentEditor && contentEditor.model && contentEditor.model.id == id) {
                            // The Content was actually deleted
                            if(shouldUnpublish) {
                                location.hash = '/content/';
                            
                            // The Content still has a synced remote
                            } else {
                                contentEditor.model = null;
                                contentEditor.fetch();

                            }
                        }

                        return Promise.resolve();
                    });
                }

                let $deleteChildrenSwitch;
                UI.confirmModal(
                    'Remove',
                    'Remove the content "' + name + '"?',
                    _.div({class: 'input-group'},      
                        _.span('Remove child content too'),
                        _.div({class: 'input-group-addon'},
                            $deleteChildrenSwitch = UI.inputSwitch(true)
                        )
                    ),
                    () => {
                        apiCall('delete', 'content/' + id + '?removeChildren=' + $deleteChildrenSwitch.data('checked'))
                        .then(() => {
                            if(shouldUnpublish && publishing.connections && publishing.connections.length > 0) {
                                return unpublishConnections();
                            } else {
                                return onSuccess();
                            }
                        })
                        .catch(errorModal);
                    }
                );
            });
        });
    }

    /**
     * Gets render settings
     *
     * @returns {Object} settings
     */
    static getRenderSettings() {
        let navbar = ViewHelper.get('NavbarMain');
        
        return {
            label: 'Content',
            route: '/content/',
            icon: 'file',
            items: resources.content,

            // Item context menu
            getItemContextMenu: (item) => {
                let menu = {};
                let isSyncEnabled = SettingsHelper.getCachedSettings(ProjectHelper.currentProject, ProjectHelper.currentEnvironment, 'sync').enabled;
                
                menu['This content'] = '---';
                menu['New child content'] = () => { this.onClickNewContent($('.context-menu-target-element').data('id')); };
                menu['Copy'] = () => { this.onClickCopyContent(); };
                menu['Copy id'] = () => { this.onClickCopyItemId(); };
                menu['Paste'] = () => { if(this.onClickPasteContent) { this.onClickPasteContent(); } else { UI.messageModal('Paste content', 'Nothing to paste'); } };

                if(!item.local && !item.remote && !item.locked) {
                    menu['Cut'] = () => { this.onClickCutContent(); };
                    menu['Remove'] = () => { this.onClickRemoveContent(true); };
                }

                if(!item.remote && !item.locked) {
                    menu['Settings'] = '---';
                    menu['Publishing'] = () => { this.onClickContentPublishing(); };
                }
                
                if(isSyncEnabled) {
                    menu['Sync'] = '---';
                    
                    if(!item.remote) {
                        menu['Push to remote'] = () => { this.onClickPushContent(); };
                    }

                    if(item.local) {
                        menu['Remove local copy'] = () => { this.onClickRemoveContent(); };
                    }
                    
                    if(item.remote) {
                        menu['Pull from remote'] = () => { this.onClickPullContent(); };
                    }
                }

                return menu;
            },

            // Set general context menu items
            paneContextMenu: {
                'General': '---',
                'New content': () => { this.onClickNewContent(); }
            },

            // Sorting logic
            sort: function(item, queueItem) {
                // Set id data attributes
                queueItem.$element.attr('data-content-id', item.id);
                queueItem.parentDirAttr = {'data-content-id': item.parentId };

                // Assign the sort index to the DOM element
                queueItem.$element.attr('data-sort', item.sort);
            },

            // End dragging logic
            onEndDrag: function(dragdropItem, dropContainer) {
                let thisId = dragdropItem.element.dataset.contentId;
                
                // Get Content node first
                ContentHelper.getContentById(thisId)
                .then((thisContent) => {
                    // Then change the sorting value
                    let thisPrevSort = thisContent.sort;
                    let newSortBasedOn = '';
                    let newSort;

                    // Feed back a success message in the console
                    function onSuccess() {
                        debug.log(
                            'Changes to Content "' + thisContent.id + '":' + 
                            '\n- sort from ' + thisPrevSort + ' to ' + thisContent.sort + ' based on ' + newSortBasedOn + 
                            navbar
                        );
                    }

                    // If this element has a previous sibling, base the sorting index on that
                    if($(dragdropItem.element).prev('.pane-item-container').length > 0) {
                        let prevSort = parseInt(dragdropItem.element.previousSibling.dataset.sort);

                        newSort = prevSort + 1;
                        newSortBasedOn = 'previous sibling';
            
                    // If this element has a next sibling, base the sorting index on that
                    } else if($(dragdropItem.element).next('.pane-item-container').length > 0) {
                        let nextSort = parseInt(dragdropItem.element.nextSibling.dataset.sort);

                        newSort = nextSort - 1;
                        newSortBasedOn = 'next sibling';

                    // If it has neither, just assign the lowest possible one
                    } else {
                        newSort = 10000;
                        newSortBasedOn = 'lowest possible index';
                    }

                    if(newSort != thisContent.sort) {
                        thisContent.sort = newSort;

                        // Save model
                        apiCall('post', 'content/' + thisContent.id, thisContent.getObject())
                        .then(onSuccess)
                        .catch(UI.erroroModal);
                        
                        dragdropItem.element.dataset.sort = thisContent.sort;
                    }
                });
            }
        }
    }
}

module.exports = ContentPane;
