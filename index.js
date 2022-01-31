
const express = require("express");
const session = require("express-session");
const app = express();
const fs = require("fs");
const { JSDOM } = require('jsdom');

// static path mappings
app.use("/js", express.static("public/js"));
app.use("/css", express.static("public/css"));
app.use("/img", express.static("public/imgs"));
app.use("/fonts", express.static("public/fonts"));
app.use("/html", express.static("public/html"));
app.use("/media", express.static("public/media"));


app.use(session(
  {
      secret:"extra text that no one will guess",
      name:"MaetsSessionID",
      resave: false,
      saveUninitialized: true })
);



app.get("/", function (req, res) {

    if(req.session.loggedIn) {
        res.redirect("/profile");
    } else {

        let doc = fs.readFileSync("./app/html/index.html", "utf8");

        res.set("Server", "Maets Engine");
        res.set("X-Powered-By", "Maets");
        res.send(doc);

    }

});


app.get("/profile", function(req, res) {

    // check for a session first!
    if(req.session.loggedIn) {

        let profile = fs.readFileSync("./app/html/profile.html", "utf8");
        let profileDOM = new JSDOM(profile);

        //get the user's data and put it into the page
        profileDOM.window.document.getElementsByTagName("title")[0].innerHTML
            = req.session.username + "'s Profile";
        profileDOM.window.document.getElementById("profile").innerHTML
            = "<h2>&ensp;Welcome back " + req.session.name + " aka " + req.session.username + "</h2>"
            + "&emsp;<b>User Info | </b>Preferred console: " + req.session.console 
            + " | User Type: " + req.session.userType + "<br>"
            + "&emsp;<b>Account Data | </b>Email: " + req.session.email 
            + " | Password (mouseover): <div class='sensitive'>" + req.session.password; + "</div>"

        console.log('begin');
        const mysql = require("mysql2");
        const connection = mysql.createConnection({
          host: "localhost",
          user: "root",
          password: "",
          database: "gamestore"
        });
    
         connection.query(
             "SELECT * FROM game",
             function(error, results, fields) {
                 // results is an array of records, in JSON format
                 // fields contains extra meta data about results
                 if (error) {
                     // in production, you'd really want to send an email to admin but for now, just console
                     console.log(error);
                 } else {
                    console.log(results);
                    let parsedData = results;
              
                    let t = "<div><h3>Fan Favourite Titles</h3>";
                    for(let i = 0; i < parsedData.length; i++) {
                      t += "<table><tr><td colspan='2'><img src='" + parsedData[i]['image'] + "'></td></tr>"
                      + "<tr><th colspan='2'>" + parsedData[i]['title'] + "</th></tr>" 
                      + "<tr><td>" + parsedData[i]['price'] + "&emsp;" + parsedData[i]['rating'] + "</td></tr>"
                      + "<tr><td colspan='2'>" + parsedData[i]['madeBy'] + "</td></tr>"
                      + "<tr><td colspan='2'>" + parsedData[i]['console'] + "</td></tr>"
                      + "<tr><td colspan='2'>" + parsedData[i]['feature'] + "</td></tr></table>"
                    }
                    t += "</div>";
                    let div = profileDOM.window.document.getElementById("products");
                    div.innerHTML = t;


                 }  
                 res.set("Server", "Maets Engine");
                 res.set("X-Powered-By", "Maets");
                 res.send(profileDOM.serialize());             
             }


           );



    } else {
        // not logged in - no session and no access, redirect to home!
        res.redirect("/");
    }



});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Notice that this is a "POST"
app.post("/login", function(req, res) {
    res.setHeader("Content-Type", "application/json");


    console.log("What was sent", req.body.email, req.body.password);


    let results = authenticate(req.body.email, req.body.password,
        function(userRecord) {
            //console.log(rows);
            if(userRecord == null) {
                // server couldn't find that, so use AJAX response and inform
                // the user. when we get success, we will do a complete page
                // change. Ask why we would do this in lecture/lab :)
                res.send({ status: "fail", msg: "User account not found." });
            } else {
                // authenticate the user, create a session
                req.session.loggedIn = true;
                req.session.name = userRecord.name;
                req.session.email = userRecord.email;
                req.session.password = userRecord.password;
                req.session.username = userRecord.username;
                req.session.console = userRecord.console;
                req.session.userType = userRecord.userType;
                req.session.save(function(err) {
                    // session saved, for analytics, we could record this in a DB
                });
                // all we are doing as a server is telling the client that they
                // are logged in, it is up to them to switch to the profile page
                res.send({ status: "success", msg: "Logged in." });
            }
    });

});

app.get("/logout", function(req,res){

    if (req.session) {
        req.session.destroy(function(error) {
            if (error) {
                res.status(400).send("Unable to log out")
            } else {
                // session deleted, redirect to home
                res.redirect("/");
            }
        });
    }
});

function authenticate(email, pwd, callback) {

    const mysql = require("mysql2");
    const connection = mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "gamestore"
    });
    connection.connect();
    connection.query(
      //'SELECT * FROM user',
      "SELECT * FROM user WHERE email = ? AND password = ?", [email, pwd],
      function(error, results, fields) {
          // results is an array of records, in JSON format
          // fields contains extra meta data about results
          console.log("Results from DB", results, "and the # of records returned", results.length);

          if (error) {
              // in production, you'd really want to send an email to admin but for now, just console
              console.log(error);
          }
          if(results.length > 0) {
              // email and password found
              return callback(results[0]);
          } else {
              // user not found
              return callback(null);
          }

      }
    );

}

/*
 * Function that connects to the DBMS and checks if the DB exists, if not
 * creates it, then populates it with a couple of records. This would be
 * removed before deploying the app but is great for
 * development/testing purposes.
 */
async function init() {

    // we'll go over promises in COMP 2537, for now know that it allows us
    // to execute some code in a synchronous manner
    const mysql = require("mysql2/promise");
    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      multipleStatements: true
    });
    const createDBAndTables = `CREATE DATABASE IF NOT EXISTS gamestore;
        use gamestore;
        CREATE TABLE IF NOT EXISTS user (
        ID int NOT NULL AUTO_INCREMENT,
        name varchar(30),
        email varchar(30),
        password varchar(30),
        username varchar(30),
        console varchar(30),
        userType varchar(30),
        PRIMARY KEY (ID));
    
        CREATE TABLE IF NOT EXISTS game (
        ID int NOT NULL AUTO_INCREMENT,
        title varchar(30),
        price varchar(30),
        rating varchar(30),
        madeBy varchar(30),
        console varchar(30),
        feature varchar(50),
        image varchar(30),
        PRIMARY KEY (ID));`;
    await connection.query(createDBAndTables);

    // await allows for us to wait for this line to execute ... synchronously
    // also ... destructuring. There's that term again!
    const [userRows, userFields] = await connection.query("SELECT * FROM user");
    // no records? Let's add a couple - for testing purposes
    if(userRows.length == 0) {
        // no records, so let's add a couple
        let userRecords = "insert into user (name, email, password, username, console, userType) values ?";
        let recordValues = [
          ["Arron", "arron_ferguson@bcit.ca", "abc123", "xX_CodeSlayer100_Xx", "PS4", "Gamer/Hardware modder"],
          ["Vincent", "vlam@bcit.ca", "abc123", "vin", "PC", "Casual gamer"],
          ["Student", "student@bcit.ca", "abc123", "TheLegend27", "Switch", "Obsessive Gamer"]
        ];
        await connection.query(userRecords, [recordValues]);
    }

    const [gameRows, gameFields] = await connection.query("SELECT * FROM game");
    if(gameRows.length == 0) {
        let userRecords = "insert into game (title, price, rating, madeBy, console, feature, image) values ?";
        let recordValues = [
            ["Anthem", "$79.99", "4.0/10", "BioWare/EA", "PC, PS4, XONE", "The Infamous Purple Rain", "/img/anthem.jpeg"],
            ["Battlefied 2042", "$79.99", "2.3/10", "DICE/EA", "PC, PS4, PS5, XONE, XSX", "An unfinished game", "/img/2042.jpeg"],
            ["Cyberpunk 2077", "$79.99", "7.1/10", "CD Projeckt RED", "PC, PS4, XONE", "Best bugs per dollar value", "/img/2077.jpeg"],
            ["Fallout 76", "$54.99", "2.8/10", "Bethesda", "PC, PS4, XONE", "All the wrong things are client-side", "/img/76.jpeg"],
            ["Final Fantasy XIV 1.0", "$24.99", "3.9/10", "Square Enix", "PC, PS3, 360", "Flower pots crash the game", "/img/xiv.jpeg"],
            ["Madden NFL 21", "$79.99", "0.5/10", "EA", "PS4, PS5, XONE, XSX", "It is literally the same game every year", "/img/nfl.jpeg"],
            ["Marvel's Avengers", "$52.99", "4.9/10", "Crystal Dynamics", "PC, PS4, XONE", "The same missions over and over", "/img/avengers.png"],
            ["Mass Effect Andromeda", "$39.99", "5.0/10", "BioWare/EA", "PC, PS4, XONE", "Nighmare inducing facial expressions", "/img/masseffect.jpeg"],
            ["Star Wars Battlefront II", "$51.99", "1.6/10", "DICE/EA", "PC, PS4, XONE", "Everything is microtransaction", "/img/starwars.jpeg"],
            ["Warcraft III Reforged", "$39.99", "0.6/10", "Activison-Blizzard", "PC", "Worse version of a 20 year old game", "/img/warcraft.png"]
        ];
        await connection.query(userRecords, [recordValues]);
    }
    console.log("Listening on port " + port + "!");
}

// RUN SERVER
let port = 8000;
app.listen(port, init);
