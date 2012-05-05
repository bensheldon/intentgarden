var express         = require('express')
  , routes          = require('./routes')
  , app             = module.exports = express.createServer();
                    
var mongoose        = require('mongoose')
  , Schema          = mongoose.Schema
  , ObjectId        = Schema.ObjectId;
                    
var passport        = require('passport')
  , TwitterStrategy = require('passport-twitter').Strategy;

// Ensure environment variables

if ( !( process.env.TWITTER_CONSUMER_KEY 
     && process.env.TWITTER_CONSUMER_SECRET
     && process.env.TWITTER_CALLBACK_URL
     && process.env.MONGOHQ
   ) ) {
  console.log("You're missing environment variables. See `sample.env`");
}

// Connect to the DB
mongoose.connect(process.env.MONGOHQ);
var User = mongoose.model('User', new Schema({
    id            : ObjectId
  , provider_id   : Number
  , username      : String
  , displayName   : String
  , avatar_url    : String
  , createdAt     : { type: Date, default: Date.now }
  , updatedAt     : { type: Date, default: Date.now }
  , auth          : {
      provider      : { type: String, default: 'twitter' }
    , token         : String
    , token_secret  : String 
  }
}));

passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: process.env.TWITTER_CALLBACK_URL
  },
  function(token, tokenSecret, profile, done) {
    //console.log(token, tokenSecret, profile);
    
    User.findOne({providerId: profile.id}, function(err, user) {
      if(!err) {
        if(!user) {
          user = new User({
              providerId  : profile.id
            , username    : profile.username
            , displayName : profile.displayName
            , avatarUrl   : profile._json.profile_image_url
            , auth        : {
                provider    : 'twitter'
              , token       : token
              , tokenSecret : tokenSecret
            }
          });
        }
        user.updatedAt = new Date();
        user.auth = {
            provider    : 'twitter'
          , token       : token
          , tokenSecret : tokenSecret
        };
        
        user.save(function(err) {
          if(!err) {
            console.log("User " + user.username + " logged in and saved/updated.");
            return done(null, user);
          }
          else {
            console.log("Error: could not save user " + user.username);
            return done(err);
          }
        });
      }
      else {
        console.log("Database Error:", err);
        return done(err);
      }
    });
  }
));

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
    User.findById(obj._id, function (err, user) {
        done(err, user);
    });
});


// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.cookieParser());  
  app.use(express.bodyParser());
  app.use(express.session({ secret: 'keyboard cat' }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});


// Redirect the user to Twitter for authentication.  When complete, Twitter
// will redirect the user back to the application at
// /auth/twitter/callback
app.get('/auth/twitter', passport.authenticate('twitter'));

// Twitter will redirect the user to this URL after approval.  Finish the
// authentication process by attempting to obtain an access token.  If
// access was granted, the user will be logged in.  Otherwise,
// authentication has failed.
app.get('/auth/twitter/callback', 
         passport.authenticate('twitter', 
          { successRedirect: '/',
            failureRedirect: '/login' }
));


app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});

// Routes
app.get('/', routes.index);





app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
