var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var rtrSchema = new Schema({
	name: {type: String, required: true},
	borough: String,
	cuisine: String,
	address:{
		street: String,
		building: String,
		zipcode: String,
		coord: {
			latitude: Number,
			longtitude: Number
		}
	},
	photo: String,
	mimetype: String,
	grades:[{
		score: {type: Number, min: 0, max: 10},
		user: String
	}],
	user: String
}, { collection: 'restaurants' });

module.exports = rtrSchema;
