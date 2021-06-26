module.exports = function (RED) {

    function mongooseConfigNode(n) {
        RED.nodes.createNode(this, n);
        this.uri = '' + n.uri;
        if (this.credentials.user || this.credentials.password) {
            this.uri = this.uri.replace('://', '://' + encodeURIComponent(this.credentials.user) + ':' + encodeURIComponent(this.credentials.password) + '@');
        }
        this.name = n.name;

        if (!!n.options) {
            try {
                this.options = JSON.parse(n.options);
            } catch (err) {
                this.error("Failed to parse options: " + err);
            }
        }
        // this.deploymentId = (1 + Math.random() * 0xffffffff).toString(16).replace('.', '');
        // console.log("passou no mongooseconf");
    }

    RED.nodes.registerType("mongooseconf", mongooseConfigNode, {
        "credentials": {
            "user": {
                "type": "text"
            },
            "password": {
                "type": "password"
            }
        }
    });

    var operations = [
        'aggregate',
        'bulkWrite',
        'count',
        'countDocuments',
        'create',
        'createCollection',
        'createIndexes',
        'deleteMany',
        'deleteOne',
        'distinct',
        'ensureIndexes',
        'estimatedDocumentCount',
        'exists',
        'find',
        'findById',
        'findByIdAndDelete',
        'findByIdAndRemove',
        'findByIdAndUpdate',
        'findOne',
        'findOneAndDelete',
        'findOneAndRemove',
        'findOneAndReplace',
        'findOneAndUpdate',
        'paginate',
        'geoSearch',
        'insertMany',
        'listIndexes',
        'delete',
        'deleteOne',
        'save',
        'remove',
        'replaceOne',
        'syncIndexes',
        'translateAliases',
        'update',
        'updateMany',
        'updateOne',
        'aggregatePaginate'
    ];

    function mongooseOp(n) {
        RED.nodes.createNode(this, n)
        var mongoose = require('mongoose');

        var node = this;
        this.config = RED.nodes.getNode(n.confignode);
        this.model = n.model;
        this.operation = n.operation;

        //console.log('conn=',mongoose.connection.readyState);
        if (mongoose.connection.readyState == 0) {
            mongoose.connect(this.config.uri, { useNewUrlParser: true, useUnifiedTopology: true });
        }

        var db = mongoose.connection;
        db.on('error', function(err){
            node.status({
                "fill": "red",
                "shape": "dot",
                "text": "Connection error:" + err
              });
              node.error('Connecio error');
        });
        db.once('open', function () {
            node.status({
                "fill": "green",
                "shape": "dot",
                "text": "Connected" 
              });
        });

        function createModel(modelName){
            //console.log('modelName:'+ modelName)
            const mongoosePaginate = require('mongoose-paginate-v2');
            var schema = {};
            var COLLECTION_NAME = "";
            RED.nodes.eachNode(function (ob) {
                if (ob.type === "mongooseModel") {
                    if (ob.name == modelName) {
                        // console.log('fields=', ob.fields);
                        if (ob.collection === '') {
                            COLLECTION_NAME = ob.name;
                        } else {
                            COLLECTION_NAME = ob.collection;
                        }
                        for (var i = 0; i < ob.fields.length; i++) {
                            var fieldName = ob.fields[i].name;
                            schema[fieldName] = { 'type': ob.fields[i].type };
    
                            var validations = ob.fields[i].validations;
                            for (var x =0; x < validations.length ; x++) {                                                                                    
                                var validation = validations[x]
                                schema[fieldName][validation.validate] = [validation.validateField , validation.validateMessage];                            
                            }                                                
                        }
                    }
                }
            });

            const aggregatePaginate = require('mongoose-aggregate-paginate-v2');

            
    
            var objSchema = new mongoose.Schema(schema, { collection: COLLECTION_NAME });
            if (mongoose.modelSchemas[modelName]) { // delete model if exists;
                mongoose.deleteModel(modelName);
            }

            objSchema.plugin(mongoosePaginate);
            objSchema.plugin(aggregatePaginate);
    
            return mongoose.model(modelName, objSchema);
        }
    

        var mModel;
        //console.log('this.model: '+this.model)
        if (this.model !== '') {
            mModel = createModel(this.model); 
        } 


       // const mModel = mongoose.model(this.model, objSchema);
        
        node.on('input', function (msg) {
            var query = msg.query || {};
            var operation = this.operation || msg.operation;
          
            if (mModel == undefined){
                mModel = createModel(msg.model); 
            }

            if (msg.model != undefined){
                mModel = createModel(msg.model);
            }

            switch (operation) {
                case 'save':
                    var newObj = new mModel(query);
                    if (query._id){
                        newObj.isNew = false;
                    }
                    newObj.save()
                    .then(obj => {
                        msg.payload = obj;
                        node.send(msg);
                    })
                    .catch(error => {
                        msg.error = error.message;
                        node.send(msg);
                    })
                    break;
                case 'paginate'  :
                    mModel.paginate(query[0], query[1])
                    .then(result=> {
                        msg.payload = result;
                        node.send(msg);
                    })
                    .catch(error => {
                        msg.error = error.message;
                        node.send(msg);
                    })
                    break;
                case 'aggregatePaginate'  :
                        var myAggregate = mModel.aggregate(query[0]);
                        mModel.aggregatePaginate(myAggregate, query[1])
                        .then(result=> {
                            //console.log(query[0]);
                            //console.log(query[1]);
                            msg.payload = result;
                            node.send(msg);
                        })
                        .catch(error => {
                            msg.error = error.message;
                            node.send(msg);
                        })
                        break;                    
                case 'updateMany'  :
                    mModel.updateMany(query[0], query[1])
                    .then(result=> {
                        msg.payload = result;
                        node.send(msg);
                    })
                    .catch(error => {
                        msg.error = error.message;
                        node.send(msg);
                    })
                    break;
                case 'updateOne'  :
                    mModel.updateMany(query[0], query[1], query[2])
                    .then(result=> {
                        msg.payload = result;
                        node.send(msg);
                    })
                    .catch(error => {
                        msg.error = error.message;
                        node.send(msg);
                    })
                    break;                        
                default:
                    //console.log('operation: '+operation)
                    //console.log('query: '+query)
                    mModel[operation](query)
                        .then(result=> {
                            msg.payload = result;
                            node.send(msg);
                        })
                        .catch(error => {
                            msg.error = error.message;
                            node.send(msg);
                        })
                    break;
            }

        });

    }

    // ,function(err, result) {
    //     if (err) {
    //         msg.error = error.message;
    //         node.send(msg);
    //     } else {
    //         msg.payload = result;
    //         node.send(msg);
    //     }
    // });


    RED.nodes.registerType("mongooseOp", mongooseOp);

    RED.httpAdmin.get('/mongooseop/operations', function (req, res) {
        res.json(operations);
    });


}