// app/connection.js
// Reference : http://wmyers.github.io/technical/nodejs/Simple-JWT-auth-for-SocketIO/
module.exports = function (io, encode, decode, connectionInfo) {
    var mongoose = require('mongoose');
    var Character = mongoose.model('Character');
    var User = mongoose.model('User');

    io.on('connection', function (socket) {
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
                    console.log('keyEvent['+socket.email+']:'+data.key+':'+data.updown);
                    sendKeyboardEvents(io, connectionInfo, socket.email, data);
                });
            }, function() {
                socket.disconnect('unauthorized');
            });
        }
        else { // from the game
            socket.on('login', function (data) {
                if (data.hasOwnProperty('email') && data.hasOwnProperty('password')) {
                    process.nextTick(function() {
                        User.findOne({'email':data.email}, function (err, user) {
                            console.log('ok 2');
                            if (err || !user) {
                                console.log('inGame: login error');
                                socket.emit('unauthorized', 'User not found');
                            } else if (!user.validPassword(data.password)) {
                                socket.emit('unauthorized', 'Wrong password');
                            } else {
                                socket.emit('authorized', user.nickname);

                                socket.on('disconnect', function () {
                                    console.info('Socket [%s] disconnected.', socket.id);
                                    connectionInfo[socket.email].onGame = null;
                                    refreshConnectionInfo(io, connectionInfo, socket.email);
                                });

                                socket.email = data.email;

                                var defaultInfo = {onGame: null, inputs : []};
                                connectionInfo[socket.email] = connectionInfo[socket.email] || defaultInfo;

                                // game input
                                if (connectionInfo[socket.email].onGame) {
                                    // already game client exists
                                    // @TODO: disconnect original game client
                                    console.log('inGame client already exists');}
                                // } else {
                                connectionInfo[socket.email].onGame = socket.id;
                                refreshConnectionInfo(io, connectionInfo, socket.email);
                                // socket.on('somethingFromGame', function (data) {});

                                socket.on('saveGame', function(data) {
                                    Character.findOne({'email':socket.email}, function (err, character) {
                                        if (err) {
                                            console.log('connection.js on saveGame error');
                                            throw err;
                                        }
                                        else {
                                            character.status = data;
                                            
                                            character.save(function(err) {
                                                if (err) {
                                                    console.log('connection.js on saveGame error (2)');
                                                    throw err;
                                                }
                                            });
                                        }
                                    });
                                });

                                socket.on('loadGame', function(data) {
                                    Character.findOne({'email':socket.email}, function (err, character) {
                                        if (err) {
                                            console.log('connection.js on loadGame error');
                                            throw err;
                                        }
                                        else {
                                            socket.emit('loadGameRes', character.status);
                                        }
                                    })
                                });
                                // }
                            }
                        })
                    })
                }
            });
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
    connectionCount = connectionInfo[email].inputs.length;
    if (connectionInfo[email].onGame) {
        io.sockets.connceted[connectionInfo[email].onGame].emit('keyEvent', data);
    }
    for (var i = 0; i < connectionCount; i++) {
        var sid = connectionInfo[email].inputs[i];
        var s = io.sockets.connected[sid];

        s.emit('keyEvent', data);
    }
}