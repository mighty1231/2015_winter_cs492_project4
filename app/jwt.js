// jwt wrapper.

var jwt  = require('jsonwebtoken');
var secretKey = 'UNITYunityUNITYchan'
module.exports.encode = function(data, callback) {
    // jwt.sign (data, secretKey, {}, function (token) {
    //     res.redirect('/index/'+token);
    // });
	jwt.sign (data, secretKey, {}, callback);
}

module.exports.decode = function (token, success, failed) {
	// jwt.verify (req.params.token, secretKey, function (err, decoded) {
	//     if (!err && decoded && decoded.email && decoded.nickname) {
	//         res.render('index.ejs',
	//             {nickname: decoded.nickname, 
	//              onGame: 'OFF',
	//              connectionCount: 0,
	//              token: req.params.token});
	//     } else {
	//         res.redirect('/login/token%20error');
	//     }
	// });
	jwt.verify (token, secretKey, function (err, decoded) {
		if (!err && decoded) {
			success(decoded);
		} else {
			failed();
		}
	});
}