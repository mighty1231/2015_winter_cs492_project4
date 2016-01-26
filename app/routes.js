// app/routes.js
module.exports = function(app, encode, decode, connectionInfo, io) {
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
     *     receive "connectionInfo", {inGame : boolean, connected keyboard sockets = (array of socket ids)}
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
    var Character = require('../app/models/character');

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

    // unitychan voice recognition
    app.post('/abc', function (req, res) {
        if(req.body.email && req.body.msg) {
            console.log('nice post : email[%s], msg[%s]', req.body.email, req.body.msg);
            var sid = connectionInfo[req.body.email].onGame;
            if (sid != null) {
                if (req.body.msg == 'avadakedavra') {
                    console.log("voice recognition, send successfully");
                    io.sockets.connected[sid].emit('keyEvent', {key:'z', updown:'down'});
                    setTimeout( function () {
                        io.sockets.connected[sid].emit('keyEvent', {key:'z', updown:'up'});
                    }, 400);
                } else if (req.body.msg == 'what is your name'){
                    res.send({msg:"my name is unity chan"});
                    io.sockets.connected[sid].emit('face', {type:'smile'});
                } else if (req.body.msg == 'hello') {
                    res.send({msg:"An nyong ha sae yo . . op pa"});
                    io.sockets.connected[sid].emit('face', {type:'smile'});
                } else if (req.body.msg == 'i love you') {
                    res.send({msg:"i hate you"});
                    io.sockets.connected[sid].emit('face', {type:'distract'});
                } else if (req.body.msg == 'where are you from') {
                    res.send({msg:"i am from japan"});
                    io.sockets.connected[sid].emit('face', {type:'smile'});
                } else if (req.body.msg == 'look at me') {
                    res.send({msg:"why"});
                    io.sockets.connected[sid].emit('face', {type:'sap'});
                } else{
                    res.send({msg:"I don't understand you"});
                }
            } else {
                res.send({msg:"Server connection is wrong"});
            }
        } else {
            console.log('wierd post : email[%s], msg[%s]', req.body.email, req.body.msg);
        }
        res.end();
    });

    // /* For game */
    // app.get('/inGame/login', function (req, res) {
    //     if (!req.query.e || !req.query.p) {
    //         console.log('e = '+req.query.e);

    //         console.log('p = '+req.query.p);
    //         res.send({status:'Error', message:'Wrong query'});
    //     } else {
    //         process.nextTick(function() {
    //             User.findOne({'email':req.query.e}, function (err, user) {
    //                 if (err) {
    //                     console.log('/inGame/login error');
    //                     res.send({status:'Error', message:''});
    //                 } else if (!user) {
    //                     res.send({status:'Error', message:'No User'});
    //                 } else if (!user.validPassword(req.query.p)) {
    //                     res.send({status:'Error', message:'Wrong password'});
    //                 } else {
    //                     encode({email: user.email, nickname: user.nickname, inGame: true},
    //                         function(token) {
    //                             res.send({status:'Success', message:'Login Success', token:token});
    //                         }
    //                     );
    //                 }
    //             })
    //         })
    //     }
    // });

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

    // signup
    app.get('/signup', function(req, res) {
        res.render('signup.ejs', {message:''});
    });

    app.post('/signup', function(req, res) {
        if (req.body.email) {
            process.nextTick(function() {
                User.findOne({'email':req.body.email}, function (err, user) {
                    if (user) {
                        res.render('signup.ejs', {message:'Given email already exists'});
                    } else if (req.body.password.length < 4) {
                        res.render('signup.ejs', {message: 'password length must be longer than 3'});
                    } else {
                        var newUser      = new User();
                        newUser.email    = req.body.email;
                        newUser.password = newUser.generateHash(req.body.password);
                        newUser.nickname = req.body.nickname;

                        // save the user
                        newUser.save(function(err) {
                            if (err)
                                throw err;
                            var newCharacter      = new Character();
                            newCharacter.email    = req.body.email;
                            newCharacter.nickname = req.body.nickname;

                            newCharacter.status.scene = 'CastleOutside';
                            newCharacter.status.onBroom = false;
                            newCharacter.status.position.x = 1889;
                            newCharacter.status.position.y = 73;
                            newCharacter.status.position.z = 1071;
                            newCharacter.status.rotation.x = 0;
                            newCharacter.status.rotation.y = -159;
                            newCharacter.status.rotation.z = 0;

                            newCharacter.save(function(err) {
                                if (err)
                                    throw err;
                                // done
                                res.redirect('/login');
                            })
                        });
                    }
                })
            })
        }
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