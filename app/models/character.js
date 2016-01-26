// load the things we need
var mongoose = require('mongoose');

// define the schema for our user model
var characterSchema = mongoose.Schema({


    email        : String,
    nickname     : String,
    
    // status       : String // json object.
    status : {
        scene    : String,
        onBroom  : Boolean,

        position : {
            x    : Number,
            y    : Number,
            z    : Number
        },
        rotation : {
            x    : Number,
            y    : Number,
            z    : Number
        }
    }
});

// create the model for users and expose it to our app
module.exports = mongoose.model('Character', characterSchema);