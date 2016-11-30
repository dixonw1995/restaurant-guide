var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var userSchema = new Schema({
	userid: {type: String, required: true, unique: true},
	password: String
}, { collection: 'users' });

module.exports = userSchema;