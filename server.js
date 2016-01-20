var express  = require('express');
var app      = express();
var http     = require('http');
var port     = 8000;
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');

var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

var configDB = require('./config/database.js');
// 'mongodb://127.0.0.1:27017'
mongoose.connect(configDB.url);

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
// app.use(bodyParser()); // get information from html forms // deprecated
app.use(bodyParser.urlencoded({ extended: true })); // get information from html forms
app.use(bodyParser.json()); // get information from html forms

app.set('view engine', 'ejs'); // set up ejs for templating

// required for passport
// @TODO: What is the meaning of resave, and saveUninitialized?
// https://github.com/expressjs/session#options
// I think what option is necessary for passport is important.
app.use(session({
	secret: 'UNITYCHANunitychanUNITYCHANunitychan',
	resave: true,
	saveUninitialized: true
})); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport
require('./config/passport')(passport); // pass passport for configuration

// launch ======================================================================
var httpServer = http.createServer(app).listen(port, function (req, res) {
	console.log('Socket IO server has been started');
});
// app.listen(port);
var io = require('socket.io').listen(httpServer);

// socket io ===================================================================
io.on('connection', function (socket) {
	console.log('New client added with socket id = ' + socket.id + " and his/her handshake : " + socket.handshake.sessionID);

});
