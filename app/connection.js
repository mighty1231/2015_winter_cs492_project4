// app/connection.js
// Reference : http://wmyers.github.io/technical/nodejs/Simple-JWT-auth-for-SocketIO/
module.exports = function (io, jwt, secretKey, connectionInfo) {

	io.on('connection', function (socket) {
		socket.token = socket.handshake.query.token;
		if (!socket.token) {
			socket.disconnect('unauthorized');
		} else {
			jwt.verify (socket.token, secretKey, function (err, decoded) {
				if (err) {
					socket.disconnect('unauthorized');

				} if (!err && decoded) {
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

					console.info('Socket [%s] connected.', socket.id);

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
	for (var i = 0; i < connectionCount; i++) {
		var sid = connectionInfo[email].inputs[i];
		var s = io.sockets.connected[sid];

		s.emit('keyEvent', data);
	}
}