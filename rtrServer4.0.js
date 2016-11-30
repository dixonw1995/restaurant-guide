var express = require('express');
var bodyParser = require('body-parser');
var fileUpload = require('express-fileupload');
var app = express();
var session = require('cookie-session');
var assert = require('assert');
var mongourl = 'mongodb://ouhk-comp:s381f@ds159747.mlab.com:59747/restaurant-guide';
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var connection = false;
mongoose.connect(mongourl);
var userSchema = require("./models/userSchema");
var User = mongoose.model("User", userSchema);
//rtr: restaurant
var rtrSchema = require("./models/rtrSchema");
var Rtr = mongoose.model("Rtr", rtrSchema);
var ObjectId = require('mongodb').ObjectID;

app.use(session({
  name: 'session',
  keys: ['key1','key2']/*,
  maxAge: 5 * 60 * 1000*/
}));
app.use(fileUpload());
app.use(bodyParser.json());
app.set('view engine', 'ejs');

app.post("/api/create", function(req, res) {
	if (!connection) {
		return res.end("Server is not ready. Try later.");
	}
	rtr = new Rtr(req.body);
	console.log(req.body);
	rtr.validate(function(err) {
		if (err) {
			res.json({status: "failed"});
			return;
		}
		rtr.save(function(err) {
			if (err) {
				res.json({status: "failed"});
				return;
			}
			res.json({
				status: "ok",
				_id: rtr._id
			});
		});
	});
});

app.get("/api/read/:f/:k", function(req, res) {
	if (!connection) {
		return res.end("Server is not ready. Try later.");
	}
	var criteria = {};
	criteria[req.params.f] = req.params.k;
	console.log(criteria);
	Rtr.find(criteria, function(err, rtrs){
		if (err) {
			return res.end(err);
		}
		if (rtrs.length > 0) {
			console.log(rtrs.length);
			res.json(rtrs);
			return;
		}
		res.json({});
	});
});

app.get("/gmap", function(req, res) {
	console.log(req.query);
	res.render("gmap", {
		lat: req.query.lat,
		lon: req.query.lon,
		zoom: 13,
		title: req.query.title
	});
});

app.all("/.*/", dbReady);

app.get("/register", function(req, res) {
	req.session = null;
	res.render("register");
});
app.post("/register", function(req, res, next) {
	var userid = req.body.userid;
	console.log(userid + " is registering")
	//register
	//if (connection) {
		req.user = new User(req.body);
		User.findOne({userid: req.user.userid}, function(err, used) {
			if (err) {
				res.render("error", {
					userid: req.session.userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			if (used) {
				res.render("error", {
					userid: req.session.userid,
					error: "Username is used",
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			next();
		});
	//}
}, function(req, res, next) {
	req.user.validate(function(err) {
		if (err) {
			res.render("error", {
				userid: req.session.userid,
				error: err,
				back: "/read" + (req.session.search) ? req.session.search : ""
			});
			return;
		}
		req.user.save(function(err) {
			if (err) {
				res.render("error", {
					userid: req.session.userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			console.log(req.userid + " has registered");
			//put in session
			req.session.userid = req.userid;
			res.redirect("/read");
		});
	});
});

app.get("/logout", function(req, res) {
	req.session = null;
	res.redirect("/");
});

//app.get(/.*/, isUser);
app.post(/.*/, function(req, res, next) {
	if (req.session.userid) {
		return next();
	}
	var userid = req.body.userid;
	console.log(userid + " is logging in")
	//login
	//if (connection) {
		//check if userid match password
		User.findOne(req.body, function(err, user) {
			if (err) {
				res.render("error", {
					userid: req.session.userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			if (user) {
				console.log(userid + " has logged in");
				//put in session
				req.session.userid = userid;
				req.method = "GET";
				next();
				return;
			}
			console.log(userid + " fails to log in");
			res.render("login");
		});
	//}
});

app.get("/", isUser, function(req, res) {
	res.redirect("/read");
});

app.route("/new")
.all(isUser)
.get(function(req, res) {
	res.render("create", {
		"userid": req.session.userid,
		"search": (req.session.search) ? req.session.search : ""
	});
})
.post(function(req, res) {
	var userid = req.session.userid;
	console.log(userid + " is creating a restaurant document");
	//format query to document
	query = req.body;
	var rtr = {
		name: query.name,
		borough: query.borough,
		cuisine: query.cuisine,
		address: {
			street: query.street,
			building: query.building,
			zipcode: query.zipcode,
			coord: {
				latitude: query.latitude,
				longtitude: query.longtitude
			}
		},
		grades: [],
		userid: userid,
		photo: "",
		mimetype: ""
	};
	if (req.files.photo.name){
		photo = req.files.photo;
		rtr.photo = new Buffer(photo.data).toString("base64");
		rtr.mimetype = photo.mimetype;
	}
	//create
	//if (connection) {
		rtr = new Rtr(rtr);
		rtr.validate(function(err) {
			if (err) {
				res.render("error", {
					userid: req.session.userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			rtr.save(function(err) {
				if (err) {
					res.render("error", {
						userid: req.session.userid,
						error: err,
						back: "/read" + (req.session.search) ? req.session.search : ""
					});
					return;
				}
				console.log(userid + " has created " + rtr.name);
				res.redirect("/read");
			});
		});
	//}
});

app.get("/read", isUser, function(req, res) {
	var userid = req.session.userid;
	for (var key in req.query) {
		if (!req.query[key]) {
			delete req.query[key];
		}
	}
	console.log(userid + " is looking for " + JSON.stringify(req.query));
	//display restaurant list
	//if (connection) {
		Rtr.find(req.query, function(err, rtrs) {
			if (err) {
				res.render("error", {
					userid: req.session.userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			res.render("catalog", {
				"userid": req.session.userid,
				"criteria": JSON.stringify(req.query),
				"rtrs": rtrs,
				"search": (req.session.search) ? req.session.search : ""
			});
			console.log(userid + " found " + rtrs.length + " restaurants");
			if (require('url').parse(req.url).query){
				req.session.search = "?" + require('url').parse(req.url).query;
			}
		});
	//}
});

app.get("/display", isUser, validOId, getRtr, function(req, res) {
	var userid = req.session.userid;
	var rtr = req.rtr;
	console.log(userid + " wants to know " + JSON.stringify(req.query));
	res.render("rtr", {
		"userid": userid,
		"rtr": rtr,
		"search": (req.session.search) ? req.session.search : ""
	});
	console.log(userid + " is browsing " + rtr.name);
});

app.route("/change")
.all(isUser, validOId, getRtr, authorityCheck)
.get(function(req, res) {
	var userid = req.session.userid;
	var rtr = req.rtr;
	res.render("edit", {
		"userid": userid,
		"rtr": rtr
	});
	console.log(userid + " wants to edit " + rtr.name);
})
.post(function(req, res) {
	var userid = req.session.userid;
	var rtr = req.rtr;
	//edit rtr/ format query to document
	var query = req.body;
	rtr.name = query.name;
	rtr.borough = query.borough;
	rtr.cuisine = query.cuisine;
	rtr.address.street = query.street;
	rtr.address.building = query.building;
	rtr.address.zipcode = query.zipcode;
	rtr.address.coord.latitude = query.latitude;
	rtr.address.coord.longtitude = query.longtitude;
	if (req.files.photo.name){
		photo = req.files.photo;
		rtr.photo = new Buffer(photo.data).toString("base64");
		rtr.mimetype = photo.mimetype;
	}
	rtr.validate(function(err) {
		if (err) {
			res.render("error", {
				userid: req.session.userid,
				error: err,
				back: "/read" + (req.session.search) ? req.session.search : ""
			});
			return;
		}
		rtr.save(function(err) {
			if (err) {
				res.render("error", {
					userid: req.session.userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			console.log(userid + " has editted " + rtr.name);
			res.redirect("/display?_id=" + rtr._id);
		});
	});
});

app.get("/remove", isUser, validOId, getRtr, authorityCheck, function(req, res) {
	var userid = req.session.userid;
	req.rtr.remove(function(err) {
		if (err) {
			res.render("error", {
				userid: req.session.userid,
				error: err,
				back: "/read" + (req.session.search) ? req.session.search : ""
			});
			return;
		}
		res.render("info", {
			userid: userid,
			info: "The restaurant has been deleted",
			back: "/read" + (req.session.search) ? req.session.search : ""
		});
		console.log(userid + " has removed " + req.query._id);
	});
});

app.route("/rate")
.all(isUser, validOId, getRtr, ratedCheck)
.get(function(req, res) {
	var userid = req.session.userid;
	var rtr = req.rtr;
	res.render("rate", {
		"userid": userid,
		"rtr": rtr
	});
	console.log(userid + " wants to rate " + rtr.name);
})
.post(function(req, res) {	
	var userid = req.session.userid;
	var rtr = req.rtr;
	//push rate/ format query to document
	var query = req.body;
	rtr.grades.push({score: query.score, user: userid});
	rtr.validate(function(err) {
		if (err) {
			res.render("error", {
				userid: req.session.userid,
				error: err,
				back: "/read" + (req.session.search) ? req.session.search : ""
			});
			return;
		}
		rtr.save(function(err) {
			if (err) {
				res.render("error", {
					userid: req.session.userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			res.render("info", {
				userid: userid,
				info: "Thank you for rating the restaurant",
				back: "/display?_id=" + rtr._id
			});
			console.log(userid + " has rated " + rtr.name);
		});
	});
});

//check if database ready
function dbReady(req, res, next) {
	var userid = req.session.userid;
	if (!connection) {
		res.render("error", {
			userid: userid,
			error: "The server is not ready<br>Please retry later",
			back: ""
		});
		return;
	}
	next();
}

//check if logged in
function isUser(req, res, next) {
	if (!req.session.userid) {
		res.render("login");
		return;
	}
	next();
}

//validate ObjectID
function validOId(req, res, next) {
	var userid = req.session.userid;
	if (!mongoose.Types.ObjectId.isValid(req.query._id)){
		res.render("error", {
			userid: userid,
			error: "The ID is invalid",
			back: "/read" + (req.session.search) ? req.session.search : ""
		});
		return;
	}
	next();
}

//validate restaurant
function getRtr(req, res, next) {
	var userid = req.session.userid;
	//if (connection) {
		Rtr.findById(ObjectId(req.query._id), function(err, rtr) {
			if (err) {
				res.render("error", {
					userid: userid,
					error: err,
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			if (!rtr) {
				res.render("error", {
					userid: userid,
					error: "The restaurant does not exist",
					back: "/read" + (req.session.search) ? req.session.search : ""
				});
				return;
			}
			req.rtr = rtr;
			next();
		});
	//}
}

//validate authority
function authorityCheck(req, res, next) {
	var userid = req.session.userid;
	var rtr = req.rtr;
	if (rtr.userid != userid) {
		res.render("error", {
			userid: userid,
			error: "You are not authorized to do so",
			back: "/display?_id=" + req.query._id
		});
		return;
	}
	next();
}

//check if rated
function ratedCheck(req, res, next) {
	var userid = req.session.userid;
	var rtr = req.rtr;
	for (var i = 0; i < rtr.grades.length; i++){
		if (rtr.grades[i].user == userid) {
			res.render("error", {
				userid: userid,
				error: "You cannot rate a restaurant twice",
				back: "/display?_id=" + req.query._id
			});
			return;
		}
	}
	next();
}

var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error'));
db.once('open', function(callback) {
	console.log("database ready");
	connection = true;
	app.listen(process.env.PORT || 8099);
	console.log("Listening to 8099...");
});