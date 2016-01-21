var express  = require('express');
var app      = express();
var http     = require('http');
var port     = 8000;
var mongoose = require('mongoose');
var jwt      = require('jsonwebtoken');

var flash    = require('connect-flash');

/* jwt token information
 * email : email
 * nickname : nickname
 * 
 */

var morgan       = require('morgan');
var bodyParser   = require('body-parser');

var configDB = require('./config/database.js');
// 'mongodb://127.0.0.1:27017'
mongoose.connect(configDB.url);

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.urlencoded({ extended: true })); // get information from html forms
app.use(bodyParser.json()); // get information from html forms

app.set('view engine', 'ejs'); // set up ejs for templating

// server data
var totalConnectionInfo = {}; // {email(String) : {onGame: socket, inputs: sockets}}

// routes ======================================================================
require('./app/routes.js')(app, jwt, "UNITYunityUNITYchan"); // load our routes and pass in our app and fully configured passport
// require('./config/passport')(passport); // pass passport for configuration

// launch ======================================================================
var httpServer = http.createServer(app).listen(port, function (req, res) {
	console.log('Socket IO server has been started');
});

var io = require('socket.io').listen(httpServer);

require('./app/connection.js')(io, jwt, "UNITYunityUNITYchan", totalConnectionInfo);