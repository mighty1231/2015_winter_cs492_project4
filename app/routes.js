// app/routes.js
module.exports = function(app, encode, decode) {
    // token : 
    /* GET /index/:token
     *     if (token is not valid || token.email is not on db)
     *         redirect ('/login')
     *     else
     *         render main.ejs with given nickname
     *
     * main.ejs
     *     Trivially, nickname is valid
     *     parse jwt token from window.location.pathname
     *     emit "connection" var s = io('', {query: "token=%s" % token}) || io.use(function(socket, next) {socket.request._query['token']}) -> email
     *     emit "keyevent", {key: key, jwt: jwt}
     *     emit "disconnect", || delete connection information
     *     receive "connectioninfo", {inGame : boolean, connected keyboard sockets = (array of socket ids)}
     *
     * GET /
     *     redirect to /login
     * GET /login
     *     render login.ejs, with email, password
     * POST /login
     *     find given email and password
     *     no email : render 'login.ejs' with message: There is no such user.
     *     yes email:
     *         no password : render 'login.ejs' with message: Wrong
     *         make token and redirect to /index/token
     */
    var User = require('../app/models/user');

    app.get('/', function (req, res) {
        res.redirect('/login');
    });

    app.get('/login', function (req, res) {
        res.render('login.ejs', {message : ""});
    });

    app.get('/login/:message', function (req, res) {
        res.render('login.ejs', {message : req.params.message});
    });

    /* For keyboard input */
    app.post('/login', function (req, res) {
        process.nextTick(function() {
            User.findOne({'email' : req.body.email}, function(err, user) {
                if (err){
                    console.log('/login error');
                    console.log(err);
                }
                else if (!user) {
                    res.render('login.ejs', {message : 'No user was found.'});
                } else if (!user.validPassword(req.body.password)) {
                    res.render('login.ejs', {message : 'Oops! Wrong password.'})
                } else {
                    encode ({email: user.email, nickname: user.nickname, inGame: false},
                        function (token) {
                            res.redirect('/index/'+token);
                        });
                }
            });
        });
    });

    /* For game */
    app.get('/inGame/login', function (req, res) {
        if (!req.query.e || !req.query.p) {
            res.send({status:'Error', message:'Wrong query'});
        } else {
            process.nextTick(function() {
                User.findOne({'email':req.query.e}, function (err, user) {
                    if (err) {
                        console.log('/inGame/login error');
                        res.send({status:'Error'});
                    } else if (!user) {
                        res.send({status:'Error', message:'No User'});
                    } else if (!user.validPassword(req.query.p)) {
                        res.send({status:'Error', message:'Wrong password'});
                    } else {
                        encode({email: user.email, nickname: user.nickname, inGame: true},
                            function(token) {
                                res.send({status:'Success', message:'Login Success', token:token});
                            }
                        );
                    }
                })
            })
        }
    });

    /* Game information */
    // app.get('/inGame/')


    app.get('/index', function (req, res) {
        res.redirect('/login');
    });

    app.get('/index/:token', function (req, res) {
        decode (req.params.token, function (decoded, failed) {
            if (!decoded.email || !decoded.nickname || decoded.inGame == true) {
                failed();
            }
            res.render('index.ejs',
                {nickname: decoded.nickname, onGame: 'OFF', connectionCount: 0, token: req.params.token});
        }, function () {
            res.redirect('/login/token%20error');
        });
    });

    // // =====================================
    // // HOME PAGE (with login links) ========
    // // =====================================
    // app.get('/main/:token', function(req, res) {
    //     // 
    //     console.log("token: "+req.params.token);
    //     if (req.params.token){
    //         console.log("seef");
    //         console.log("there is token:" + req.params.token);
    //     }
    //     else{
    //         console.log("there is no token");
    //     }

    //     // res.render('index.ejs', {
    //     // user: req.user
    //     // }); // load the index.ejs file
    // });

    // // =====================================
    // // LOGIN ===============================
    // // =====================================
    // // show the login form
    // app.get('/login', function(req, res, next) {
    //     // if (req.isAuthenticated()) {
    //     // 	res.redirect('/');
    //     // }

    //     // render the page and pass in any flash data if it exists
    //     // else {
    //     	res.render('login.ejs', {message:""}); 
    //     // }
    // });

    // app.get('/', function(req, res, next) {
    //     // res.render('empty.ejs')
    //     res.status(403).json({message:"sdf"})
    // });

    // // process the login form
    // // app.post('/login', do all our passport stuff here);

    // // =====================================
    // // SIGNUP ==============================
    // // =====================================
    // // show the signup form
    // app.get('/signup', function(req, res) {

    //     // render the page and pass in any flash data if it exists
    //     res.render('signup.ejs', { message: req.flash('signupMessage') });
    // });

    // // process the signup form
    // // app.post('/signup', do all our passport stuff here);

    // // =====================================
    // // PROFILE SECTION =====================
    // // =====================================
    // // we will want this protected so you have to be logged in to visit
    // // we will use route middleware to verify this (the isLoggedIn function)
    // app.get('/profile', isLoggedIn, function(req, res) {
    //     res.render('profile.ejs', {
    //         user : req.user // get the user out of session and pass to template
    //     });
    // });

    // // =====================================
    // // LOGOUT ==============================
    // // =====================================
    // app.get('/logout', function(req, res) {
    //     req.logout();
    //     res.redirect('/');
    // });

    // // signup form.
    // app.post('/signup', function (req, res)/*passport.authenticate('local-signup',*/ {
    //     // successRedirect : '/profile', // redirect to the secure profile section
    //     // failureRedirect : '/signup', // redirect back to the signup page if there is an error
    //     // failureFlash : true // allow flash messages
    // });


    // // process the login form
    // // app.post('/login', /*passport.authenticate('local-login',*/ function (req, res) {
    // //     // successRedirect : '/', // redirect to the secure profile section
    // //     // failureRedirect : '/login', // redirect back to the signup page if there is an error
    // //     // failureFlash : true // allow flash messages
    // // });
    // app.post('/login', /*passport.authenticate('local-login',*/ function (req, res) {
    //     // successRedirect : '/', // redirect to the secure profile section
    //     // failureRedirect : '/login', // redirect back to the signup page if there is an error
    //     // failureFlash : true // allow flash messages
    //     res.render('login.ejs', {message:"wefw"});
    // });

};