const Discord = require("discord.js");
const mysql = require("mysql");
const token = require("./config.js");

const VALID_CMDS = ["!hello", "!test", "!points", "!haha", "!funniest", "!help", "!lb"];
var TIME_NOW_IN_SECONDS = Math.floor(Date.now()/1000);

var bot = new Discord.Client();

var db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "mydb"
});

//EVENT LISTENERS

bot.on("ready", () => {
    connectToDB();
    prepUsersTable();
});

bot.on("message", function(message) {
    if (message.author.equals(bot.user)) return;

    var command = message.content.split(" ")[0];
    var param = message.content.split(" ")[1];
    var GUILD = bot.guilds.values().next().value;

    if (!VALID_CMDS.includes(command)) return;
 
    switch (command) {
        case "!hello":
            if (param) { message.channel.send("Hello, " + param); }
            else { message.channel.send("Use a second parameter and try again. FORMAT: !hello <name_goes_here>"); }
            break;
        case "!lb":
            message.channel.send("Comedy Leaderboard: " + GUILD.name);
            getAllMemberScores().then((results) => {
                message.channel.send(results.join("\n"));
            })
            break;
        case "!points":
        	if(!param) return;
        	var uid = param.substring(3, 21);
        	if(!isValidTag(uid)){
        		uid = param.substring(2,20);
                if(!isValidTag(uid)){
                    message.channel.send("User not found or invalid format. Type !haha @<discord_handle>");
                    return;
                }
        	}

            getPoints(uid).then((points) => {
                message.channel.send(param + " has " + points + " points");
            }).catch((points) => {
            	message.channel.send(points);
            })
            break;
        case "!haha":
        	if(!param) return;
        	var uid = param.substring(3,21);
        	if(message.author.id == uid){
        		message.channel.send("You cant give a point to yourself silly");
        		return;
        	}
        	if(!isValidTag(uid)){
        		uid = param.substring(2,20);
                if(!isValidTag(uid)){
                    message.channel.send("User not found or invalid format. Type !haha @<discord_handle>");
                    return;
                }
        	}

        	canGivePoint(message.author.id).then(() => {
        		givePoint(message.author.id,uid).then((msg) => {
                	message.channel.send(message.author.username + msg + param);
            	}).catch((msg) => {
                	message.channel.send(msg);
            	})
        	}).catch((msg) => {
        		message.channel.send(msg);
        	})
            break;
        case "!funniest":
            getFunniestMember().then((members) => {
                if (members.length > 1) {
                    message.channel.send(`There is a ${members.length}-way tie for comedy king between:`);
                    message.channel.send(members.join(" - "));
                } else {
                    message.channel.send(`All hail the comedy king: ${members[0]}`);
                }
            })
            break;
        case "!help":
            msg = printCommands();
            message.channel.send(msg);
            break;
    }
});

bot.on("guildMemberAdd", function (member) {
    var sql = `"INSERT INTO users (user_id, user_name, last_point_given_at) VALUES(${member.id.toString()}, ${member.user.username.toString()}, ${null}`;
    db.query(sql, function (err, results) {
        if (err) throw err;
        if (result) {
            console.log("Successful insertion of user into table");
        }
    });
});

bot.on("guildMemberUpdate", function (oldmember, newmember) {
    var sql = `UPDATE users SET user_name=${newmember.user.username} WHERE id=${newmember.id}`
    db.query(sql, function (err, results) {
        if (err) throw err;
        console.log(`Name updated in database: ${oldmember.user.username} has been changed to ${newmember.user.username}`);
    });
});

//CUSTOM FUNCTIONS

function connectToDB() {
    db.connect(function (err) {
        if (err) throw err;
        console.log("Connected!");
    });
}

function prepUsersTable() {
    let guildMembers = bot.guilds.values().next().value.members //returns a collection of all members of a discord server
    guildMembers.forEach(function (member) {
        //checking if user id exists in db already
        db.query("SELECT id FROM users WHERE user_id=" + member.id.toString(), function (err, result) {
            if (err) throw err;
            //if object is empty
            if (resultEmpty(result)) {
                var sql = `INSERT INTO users (user_id, user_name, last_point_given_at) VALUES (${member.id.toString()},${member.user.username.toString()},${null}`;
                db.query(sql, function (err, result) {
                    if (err) throw err;
                    if (result) {
                        console.log("Successful insertion of user into table");
                        //result of a SQL insertion does NOT provide any specific column data
                    }
                });
            }
        });
    });
}

function resultEmpty(result) {
    return Object.keys(result).length === 0;
}

function getPoints(userid) {
    return new Promise((resolve, reject) => {
    	if(userid == ""){userid = 0;}
        let sql = `SELECT points, user_name FROM users WHERE user_id=${userid}`;
        db.query(sql, function (err, result) {
            if (err) throw err;
            if (!resultEmpty(result)) {
                resolve(result[0].points);
            } else {
                reject("User not found");
            }
        });
    });   
}

function givePoint(authorid,userid) {
    return new Promise((resolve, reject) => {
        let sql = `SELECT points FROM users WHERE user_id=${userid}`;
        db.query(sql, function (err, result) {
            if (err) throw err;
            if (!resultEmpty(result)) {
                let newPoints = result[0].points += 1;
                sql = `UPDATE users SET points=${newPoints.toString()} WHERE user_id=${userid}`;
                db.query(sql, function (err, result) {
                    if (err) throw err;
                    updateTime(authorid);
                    resolve(" gave a point to ");
                });
            } else {
                reject("User not found");
            }
        });
    });    
}

function canGivePoint(uid){
	return new Promise ((resolve, reject) => {
		TIME_NOW_IN_SECONDS = Math.floor(Date.now()/1000);
		let sql = `SELECT last_point_given_at FROM users WHERE user_id=${uid}`;
		db.query(sql, function(err, result) {
			if (err) throw err;
			if(result[0].last_point_given_at == null || result[0].last_point_given_at <= TIME_NOW_IN_SECONDS){
				resolve();
			}
			let timeLeftToWait = result[0].last_point_given_at - TIME_NOW_IN_SECONDS;
			reject("You have to wait another " + timeLeftToWait + " seconds before giving someone a comedy point!");
		});
	});
}

function getFunniestMember() {  
    return new Promise((resolve, reject) => {
        let members = [];
        let sql = `SELECT user_name, points FROM users WHERE points = (SELECT MAX(points) FROM users)`;
        db.query(sql, function (err, result) {
            if (err) throw err;
            result.forEach(function (result) {
                members.push(result.user_name); 
            });
            resolve(members);
        });
    });    
}

function getAllMemberScores() {
    return new Promise(function (resolve, reject) {
        let member_rows = [];
        let sql = `SELECT user_name, points FROM users ORDER BY points DESC`;
        db.query(sql, function (err, results) {
            if (err) throw err;
            var i = 0;
            results.forEach((member) => {
                if (i < 10) {
                    member_rows.push(`${i+1}. ${member.user_name} - ${member.points} points`)
                }
                i++;
            });
            resolve(member_rows);
        });
    });    
}

function printCommands() {
    return `1. !hello <name> - The bot will say hello to you\n
2. !test - Lists all of the members in this server\n
3. !points <name> - Gives you a member's point score\n
4. !haha <name> - Gives a point to a member\n
5. !funniest - Tells you who the comedy king of the server is (Ties between players are recognized)\n
6. !lb - Displays the server's comedy score leaderboard\n
7. !help - Brings up a list of available commands for comedy-ladder`;
}

function updateTime(uid){
	let delay = 120;
	TIME_NOW_IN_SECONDS = Math.floor(Date.now()/1000);
	return new Promise(function (resolve, reject){
		let sql = `UPDATE users SET last_point_given_at='${TIME_NOW_IN_SECONDS + delay}' WHERE user_id=${uid}`;
		db.query(sql, function(err, result){
			if(err) throw err;
		});
	});
}

function isValidTag(tag){
	regex = new RegExp("^[0-9]{18}$");
	return regex.test(tag);
}

bot.login(token.token);

