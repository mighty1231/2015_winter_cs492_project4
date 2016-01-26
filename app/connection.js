// app/connection.js
// Reference : http://wmyers.github.io/technical/nodejs/Simple-JWT-auth-for-SocketIO/
module.exports = function (io, encode, decode, connectionInfo) {
    var mongoose = require('mongoose');
    var Character = mongoose.model('Character');
    var User = mongoose.model('User');

    io.on('connection', function (socket) {
        console.log("socket connecting... with id = "+socket.id);
        if (socket.handshake.query.token) { // from the web
            decode(socket.handshake.query.token, function (decoded, failed) {
                if (!decoded.email)
                    failed();
                socket.email = decoded.email;

                socket.on('disconnect', function () {
                    console.info('Socket [%s] disconnected.', socket.id);

                    var index = connectionInfo[socket.email].inputs.indexOf(socket.id);
                    if (index == -1)
                        console.log('error on disconnecting... fail to find socket');
                    else {
                        connectionInfo[socket.email].inputs.splice(index, 1);
                        refreshConnectionInfo(io, connectionInfo, socket.email);
                    }
                });

                console.info('Socket [%s] connected, with inGame=[%s]', socket.id, decoded.inGame);

                // keyboard inputs
                // TODO : refresh connectionInfo
                // send connectionInfo to specific room.
                var defaultInfo = {onGame: null, inputs : []};
                connectionInfo[socket.email] = connectionInfo[socket.email] || defaultInfo;
                connectionInfo[socket.email].inputs.push(socket.id);

                // send connectionInfo to all sockets
                refreshConnectionInfo(io, connectionInfo, socket.email);

                socket.on('keyEvent', function (data) {
                    sendKeyboardEvents(io, connectionInfo, socket.email, data);
                });
            }, function() {
                console.log('decoding token failed');
                socket.disconnect('unauthorized');
            });
        }
        else { // from the game
            // to make easy-developing environment
            var afterLoginInGame = function(socket, email) {
                socket.email = email;

                socket.on('disconnect', function () {
                    console.info('Socket [%s] disconnected.', socket.id);
                    connectionInfo[socket.email].onGame = null;
                    process.nextTick(function() {
                        Character.findOne({'email':socket.email}, function (err, character) {
                            if (err) {
                                console.log('connection.js on saveGame error');
                                throw err;
                            }
                            else {
                                if (socket.scene && socket.scene != 'dungeon' && socket.position) {
                                    character.status.scene = socket.scene || character.status.scene;
                                    character.status.position.x = socket.position.x || character.status.position.x;
                                    character.status.position.y = socket.position.y || character.status.position.y;
                                    character.status.position.z = socket.position.z || character.status.position.z;
                                    character.status.rotation.x = socket.rotation.x || character.status.rotation.x;
                                    character.status.rotation.y = socket.rotation.y || character.status.rotation.y;
                                    character.status.rotation.z = socket.rotation.z || character.status.rotation.z;
                                }
                                character.status.onBroom = socket.onBroom || character.status.onBroom;
                                
                                character.save(function(err) {
                                    if (err) {
                                        console.log('connection.js on saveGame error (2)');
                                        throw err;
                                    }
                                });
                            }
                        });
                    });
                    refreshConnectionInfo(io, connectionInfo, socket.email);
                });

                // initialize if it does not exist
                var defaultInfo = {onGame: null, inputs : []};
                connectionInfo[socket.email] = connectionInfo[socket.email] || defaultInfo;

                // game input
                if (connectionInfo[socket.email].onGame) {
                    // already game client exists
                    // @TODO: disconnect original game client
                    console.log('inGame client already exists');
                    socket.emit('unauthorized', {msg:'you are already on game'});
                    return;
                }

                connectionInfo[socket.email].onGame = socket.id;
                refreshConnectionInfo(io, connectionInfo, socket.email);

                socket.on('saveGame', function(data) {
                    console.log('saveGame called');
                    process.nextTick(function() {
                        Character.findOne({'email':socket.email}, function (err, character) {
                            if (err) {
                                console.log('connection.js on saveGame error');
                                throw err;
                            }
                            else {
                                character.status = data.status;
                                
                                character.save(function(err) {
                                    if (err) {
                                        console.log('connection.js on saveGame error (2)');
                                        throw err;
                                    }
                                });
                            }
                        });
                    });
                });

                socket.on('loadGame', function(data) {
                    console.log('loadgame called');
                    process.nextTick(function() {
                        Character.findOne({'email':socket.email}, function (err, character) {
                            if (err) {
                                console.log('connection.js on loadGame error');
                                throw err;
                            }
                            else {
                                socket.emit('loadGameRes', {status:character.status});
                            }
                        })
                    });
                });

                socket.on('update', function (data) {
                    // email
                    // scene name && changed boolean ( prefab 만들거나 없앰 )
                    // onBroom
                    // transform(vector3, quaternion)
                    // shooting components // animation information
                    var sceneChange = false;
                    var prevScene = '';
                    var nextScene = '';
                    if (data.scene && data.scene != socket.scene) {
                        sceneChange = true;
                        prevScene = socket.scene;
                        nextScene = data.scene;
                        socket.scene = nextScene;
                        console.log("socket[%s] scene change %s->%s", socket.email, prevScene, nextScene);
                    }
                    if (data.position) {
                        socket.position = data.position;
                    }
                    if (data.rotation) {
                        socket.rotation = data.rotation;
                    }
                    if (data.onBroom) {
                        socket.onBroom = data.onBroom;
                    }
                    for (email in connectionInfo) {
                        var gameSid = connectionInfo[email].onGame;
                        if (gameSid && gameSid != socket.id) {
                            var tmpSocket = io.sockets.connected[gameSid];
                            if (tmpSocket) {
                                if (sceneChange) {
                                    // data need
                                    if (prevScene == tmpSocket.scene) {
                                        data.email = socket.email;
                                        data.make = false;
                                        tmpSocket.emit('update', data);
                                    } else if (nextScene == tmpSocket.scene) {
                                        data.email = socket.email;
                                        data.make = true;
                                        tmpSocket.emit('update', data);
                                    } else {
                                        // do not necessarily emit
                                    }
                                } else if (tmpSocket.scene == socket.scene){
                                    // make position
                                    data.email = socket.email;
                                    tmpSocket.emit('update', data);
                                } else {
                                    // do not necessarily emit
                                }

                            } else {
                                // there is no game client for this email
                            }
                        }
                    }
                });
            };

            console.log("develop and login hook applied to " + socket.id);
            socket.on('develop', function (data) {
                console.log('developing environment requested');
                afterLoginInGame(socket, "test");
            });
            socket.on('login', function (data) {
                if (data.hasOwnProperty('email') && data.hasOwnProperty('password')) {
                    process.nextTick(function() {
                        User.findOne({'email':data.email}, function (err, user) {
                            console.log('ok 2');
                            if (err || !user) {
                                console.log('inGame: login error');
                                socket.emit('unauthorized', {msg:'User not found'});
                            } else if (!user.validPassword(data.password)) {
                                console.log('inGame: login error');
                                socket.emit('unauthorized', {msg:'Wrong password'});
                            } else {
                                process.nextTick(function() {
                                    Character.findOne({'email':user.email}, function(err, character) {
                                        if (err || !user) {
                                            console.log('critical error..???');
                                        }else {
                                            socket.scene = character.status.scene;
                                            console.log(character.status.scene);
                                            console.log(character.status.onBroom);
                                            console.log(character.status.position.y);
                                            console.log({email:user.email, nickname:user.nickname, 
    status : {
        scene    : character.status.scene,
        onBroom  : character.status.onBroom,

        position : {
            x    : character.status.position.x,
            y    : character.status.position.y,
            z    : character.status.position.z
        },
        rotation : {
            x    : character.status.rotation.x,
            y    : character.status.rotation.y,
            z    : character.status.rotation.z
        }
    }});
                                            socket.emit('authorized', {email:user.email, nickname:user.nickname, 
    status : {
        scene    : character.status.scene,
        onBroom  : character.status.onBroom,

        position : {
            x    : character.status.position.x,
            y    : character.status.position.y,
            z    : character.status.position.z
        },
        rotation : {
            x    : character.status.rotation.x,
            y    : character.status.rotation.y,
            z    : character.status.rotation.z
        }
    }});
                                        }
                                    })
                                })

                                afterLoginInGame(socket, user.email);
                                // }
                            }
                        })
                    })
                }
            });

            socket.emit('ready', {});
        }
    });
}

function refreshConnectionInfo(io, connectionInfo, email) {
    var onGame, connectionCount;
    if ( connectionInfo[email].onGame )
        onGame = 'ON';
    else 
        onGame = 'OFF';
    connectionCount = connectionInfo[email].inputs.length;
    for (var i = 0; i < connectionCount; i++) {
        var sid = connectionInfo[email].inputs[i];
        var s = io.sockets.connected[sid];

        s.emit('connectionInfo', {onGame: onGame, connectionCount: connectionCount});
    }
}

function sendKeyboardEvents(io, connectionInfo, email, data) {
    console.log('keyEvent['+email+']:'+data.key+':'+data.updown+', onGame='+connectionInfo[email].onGame);
    connectionCount = connectionInfo[email].inputs.length;
    if (connectionInfo[email].onGame) {
        io.sockets.connected[connectionInfo[email].onGame].emit('keyEvent', data);
    }
    for (var i = 0; i < connectionCount; i++) {
        var sid = connectionInfo[email].inputs[i];
        var s = io.sockets.connected[sid];

        s.emit('keyEvent', data);
    }
}