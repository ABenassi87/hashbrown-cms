'use strict';

const RequestHelper = require('Client/Helpers/RequestHelper');
const SchemaHelper = require('Client/Helpers/SchemaHelper');

// Dashboard
Crisp.Router.route('/schemas/', function() {
    if(currentUserHasScope('schemas')) {
        Crisp.View.get('NavbarMain').showTab('/schemas/');
        
        UI.setEditorSpaceContent(
            [
                _.h1('Schemas'),
                _.p('Right click in the Schemas pane to create a new Schema.'),
                _.p('Click on a Schema to edit it.'),
                _.p('Click the button below to start a tour of the Schema section.'),
                _.button({class: 'widget widget--button condensed', title: 'Click here to start the tour'}, 'Start tour')
                    .click(() => {
                        HashBrown.Helpers.SchemaHelper.startTour();
                    })
            ],
            'text'
        );
    
    } else {
        location.hash = '/';

    }
});

// Edit
Crisp.Router.route('/schemas/:id', () => {
    if(currentUserHasScope('schemas')) {
        let schema;
        let parentSchema;

        Crisp.View.get('NavbarMain').highlightItem('/schemas/', Crisp.Router.params.id);
       
        // First get the Schema model
        SchemaHelper.getSchemaById(Crisp.Router.params.id)
        .then((result) => {
            schema = SchemaHelper.getModel(result);

            // Then get the parent Schema, if available
            if(schema.parentSchemaId) {
                return SchemaHelper.getSchemaWithParentFields(schema.parentSchemaId);
            }
    
            return Promise.resolve(null);
        })
        .then((result) => {
            if(result) {
                parentSchema = SchemaHelper.getModel(result);
            }

            let schemaEditor;

            if(schema instanceof HashBrown.Models.ContentSchema) {
                schemaEditor = new HashBrown.Views.Editors.ContentSchemaEditor({
                    model: schema,
                    parentSchema: parentSchema
                });
            } else {
                schemaEditor = new HashBrown.Views.Editors.FieldSchemaEditor({
                    model: schema,
                    parentSchema: parentSchema
                });
            }
            
            UI.setEditorSpaceContent(schemaEditor.$element);
        });
            
    } else {
        location.hash = '/';

    }
});

// Edit (JSON editor)
Crisp.Router.route('/schemas/json/:id', function() {
    if(currentUserHasScope('schemas')) {
        let jsonEditor = new HashBrown.Views.Editors.JSONEditor({
            model: SchemaHelper.getSchemaByIdSync(this.id),
            apiPath: 'schemas/' + this.id,
            onSuccess: () => {
                return RequestHelper.reloadResource('schemas')
                .then(() => {
                    let navbar = Crisp.View.get('NavbarMain');
                    
                    navbar.reload();
                });
            }
        });

        Crisp.View.get('NavbarMain').highlightItem('/schemas/', this.id);
        
        UI.setEditorSpaceContent(jsonEditor.$element);
    
    } else {
        location.hash = '/';

    }
});
