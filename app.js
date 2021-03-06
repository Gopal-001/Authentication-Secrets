//jshint esversion:6

require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findOrCreate");


const app = express();

// console.log(md5("madrauchiha"));


app.use(express.static("public"));
app.set('view engine','ejs');
app.use(bodyParser.urlencoded({
  extended: true
}));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB",{useNewUrlParser: true, useUnifiedTopology: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.route("/")
  .get(function(req,res){
  res.render("home");
});

app.route("/auth/google")
  .get(
    passport.authenticate("google", {scope: ["profile"]})
  );

  app.get("/auth/google/secrets",
    passport.authenticate("google", { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect secrets page.
      res.redirect('/secrets');
    });
app.route("/submit")
  .get(function(req,res){
  if(req.isAuthenticated()){
    res.render("submit");
  }else{
    res.redirect("/login");
  }
})
  .post(function(req,res){
    const submittedSecret = req.body.secret;

    console.log(req.user._id);
    User.findById( req.user._id , function(err, foundUser){
      if(err){
        console.log(err);
      }else{
        if(foundUser){
          foundUser.secret = submittedSecret;
          foundUser.save(function(){
            res.redirect("/secrets");
          });
        }
      }
    });
  });

app.route("/login")
  .get(function(req,res){
  res.render("login");
  })
  .post(function(req,res){
    const user = new User({
      username: req.body.username,
      password: req.body.password
    });
    req.login(user, function(err){
      if(err){
        console.log(err);
      }else{
        passport.authenticate("local")(req,res,function(){
          res.redirect("/secrets");
        });
      }
    })
  });

app.route("/logout")
  .get(function(req,res){
    req.logout();
    res.redirect("/");
  });


app.route("/secrets")
  .get(function(req,res){
    User.find({"secret": {$ne: null}},function(err, foundUsers){
      if(!err){
        if(foundUsers !== null){
          res.render("secrets", { usersWithSecrets: foundUsers});
        }
      }else{
        console.log(err);
      }
    })
});


app.route("/register")
  .get(function(req,res){
  res.render("register");
  })
  .post(function(req,res){
    User.register({username: req.body.username}, req.body.password, function(err, user){
      if(err){
        console.log(err);
        res.redirect("/register");
      }else{
        passport.authenticate("local")(req,res,function(){
          res.redirect("/secrets");
        });
      }
    });
});

app.listen(3000, function(err){
  if(err){
    console.log(err);
  }else{
    console.log("Server started at localhost:3000 ");
  }
});
