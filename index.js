const Discord = require("discord.js");
const mysql = require("mysql");
const token = require("./config.js");

const VALID_CMDS = ["!hello", "!test", "!points", "!haha", "!funniest", "!help", "!lb"];

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

    if (!VALID_CMDS.includes(command)) return;
    var GUILD = bot.guilds.values().next().value;
    switch (command) {
        case "!hello":
            if (param) { message.channel.send("Hello, " + param); }
            else { message.channel.send("Use a second parameter and try again. FORMAT: !hello <name_goes_here>"); }
            break;
        case "!lb":
            message.channel.send("Comedy Leaderboard: " + GUILD.name);
            getAllMemberScores().then((results) => {
                message.channel.send(results.join("\n-----------------------------------------\n"));
            })
            break;
        case "!points":
        	if(!param) return;
        	var uid = param.substring(2,20);
            getPoints(uid).then((points) => {
                if (points > -1) {
                    message.channel.send(param + " has " + points + " points");
                }
            }).catch((points) => {
            	message.channel.send(points);
            })
            break;
        case "!haha":
        	if(!param) return;
        	var uid = param.substring(2,20);
            givePoint(uid).then((msg) => {
                message.channel.send(message.author.username + msg + param);
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
            //printCommands();
            msg = printCommands();
            console.log(msg);
            message.channel.send(msg);
            break;
            
    }
});

bot.on("guildMemberAdd", function (member) {
    var sql = "INSERT INTO users (user_id, user_name, last_point_given_at)" + " VALUES(" + "'" + member.id.toString() + "'" + ", '" + member.user.username.toString() + "', " + null + ")";
    db.query(sql, function (err, results) {
        if (err) throw err;
        if (result) {
            console.log("Successful insertion of user into table");
        }
    })
})

bot.on("guildMemberUpdate", function (oldmember, newmember) {
    var sql = `UPDATE users SET user_name=${newmember.user.username} WHERE id=${newmember.id}`
    db.query(sql, function (err, results) {
        if (err) throw err;
        console.log(`Name updated in database: ${oldmember.user.username} has been changed to ${newmember.user.username}`);
    })
})

//CUSTOM FUNCTIONS

function connectToDB() {
    db.connect(function (err) {
        if (err) throw err;
        console.log("Connected!");
    });
}

function prepUsersTable() {
    var guildMembers = bot.guilds.values().next().value.members //returns a collection of all members of a discord server
    guildMembers.forEach(function (member) {
        //checking if user id exists in db already
        db.query("SELECT id FROM users WHERE user_id=" + member.id.toString(), function (err, result) {
            if (err) throw err;
            //if object is empty
            if (resultEmpty(result)) {
                var sql = "INSERT INTO users (user_id, user_name, last_point_given_at)" + " VALUES(" + "'" + member.id.toString() + "'" + ", '" + member.user.username.toString() + "', " + null + ")";
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
        var GUILD = bot.guilds.values().next().value;

        var sql = "SELECT points, user_name FROM users WHERE user_id=" + "'" + userid + "'";
        db.query(sql, function (err, result) {
            if (err) throw err;
            if (!resultEmpty(result)) {
                console.log(result[0].user_name + " has " + result[0].points + " points");
                resolve(result[0].points);
            } else {
                console.log("User not found.")
                resolve(-1);
            }
        });
    });   
}

function givePoint(userid) {
    return new Promise((resolve, reject) => {
        var sql = "SELECT points FROM users WHERE user_id=" + "'" + userid + "'" ;
        console.log(sql);
        db.query(sql, function (err, result) {
            if (err) throw err;
            if (!resultEmpty(result)) {
                const newPoints = result[0].points += 1;
                sql = "UPDATE users SET points=" + newPoints.toString() + " WHERE user_id=" + "'" + userid + "'";
                db.query(sql, function (err, result) {
                    if (err) throw err;
                    resolve(" gave a point to ");
                });
            } else {
                reject("User not found");
            }
        });
    });    
}

function getFunniestMember() {  
    return new Promise((resolve, reject) => {
        var members = [];
        var sql = `SELECT user_name, points FROM users WHERE points = (SELECT MAX(points) FROM users)`;
        db.query(sql, function (err, result) {
            if (err) throw err;
            result.forEach(function (result) {
                members.push(result.user_name); 
            })
            resolve(members);
        });
    });    
}

function getAllMemberScores() {
    return new Promise(function (resolve, reject) {
        var member_rows = [];
        var sql = `SELECT user_name, points FROM users ORDER BY points DESC`;
        db.query(sql, function (err, results) {
            if (err) throw err;
            results.forEach((member) => {
                member_rows.push(`${member.user_name} - ${member.points} points`)
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

bot.login(token.token);

