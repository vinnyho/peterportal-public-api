const express = require('express')
const router = express.Router()
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const emailTemplates = require('email-templates')

const faunadb = require('faunadb')
const client = new faunadb.Client({ secret: process.env.FAUNADB_KEY});
const {
  Get,
  Select,
  Collection,
  Match,
  Index,
  Map,
  Paginate,
  Lambda,
  Var,
  Update
} = faunadb.query;

var path = require('path')

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAILER_USER,
    pass: process.env.MAILER_PASS
      }
});

const email = new emailTemplates({
  transport: transporter,
  send: true,
  preview: false,
  views: {
      options: {
        extension: 'ejs',
      },
      root: path.resolve('email'),
    }
});

router.get("/", function (req, res, next) {
    res.send(generateApiKey())
});

router.post("/", function (req, res, next) {

    const data = {
        apiKey: req.body.appName.replace(/ /g, "_") + "-" + generateApiKey(),
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        appName: req.body.appName,
        appDescription: req.body.appDescription,
        websiteURL: req.body.websiteURL ? req.body.websiteURL : null,
        keyStatus: "Awaiting Verification",
        createdOn: new Date()
      }
    console.log(data);
    insertApiKeyToDatabase(data).then((ret) => {sendVerificationEmail(ret.data)})
    res.json(data)
});

router.get("/confirm/:apiKey", function (req, res, next) {

  activateAPIKey(req.params.apiKey).then((ret) => {
    console.log("returned", ret);
    sendAPIKeyEmail(ret.data);
    res.send("confirmed " + req.params.apiKey);
  }).catch((err) => {console.log(err)});
});

async function insertApiKeyToDatabase(data) {
  // let sql = `INSERT INTO api_keys
  // (apiKey, firstName, lastName, email, appName, appDescription, websiteURL, keyStatus, createdOn)
  // VALUES( ${escape(data.apiKey)},
  //         ${escape(data.firstName)}, 
  //         ${escape(data.lastName)}, 
  //         ${escape(data.email)}, 
  //         ${escape(data.appName)}, 
  //         ${escape(data.appDescription)}, 
  //         ${escape(data.websiteURL)}, 
  //         ${escape(data.keyStatus)},
  //         ${escape(data.createdOn)});`
  const ret = await client.query( 
    Create(
      Collection("api_keys"), {
        data: {
          "key": data.apiKey,
          "first_name": data.firstName,
          "last_name": data.lastName,
          "email": data.email,
          "app": {
            "name": data.appName,
            "description": data.appDescription,
            "url": data.websiteURL,
          },
          "status": data.keyStatus,
          "created_on": data.createdOn
        }
      })
  ).catch((err) => console.log(err));
  return ret;
}

async function activateAPIKey(key) {
  const ret = await client.query(
    Update(
      Select("ref",
        Get(
          Match(Index("keys_by_key"), key)
        )
      ),
      {
        data: {
          status: "active",
        },
      },
    )
  ).catch((err) => console.log(err));
  return ret;
}

function sendVerificationEmail(data) {    
  email.send({
    template: 'apiConfirmation',
    message: {
      from: 'PeterPortal API <peterportal.dev@gmail.com>',
      to: 'peterportal.dev@gmail.com',
    },
    locals: {
      firstName: data['first_name'],
      appName: data['app']['name'],
      confirmationURL: 'http://localhost:8080/generateKey/confirm/' + data['key'],
      unsubscribeURL: 'http://localhost:8080/unsubscribe/' + data['email']
    },
  }).then(() => console.log('email has been sent!'));
}

function sendAPIKeyEmail(data) {    
  email.send({
    template: 'apiKeyDelivery',
    message: {
      from: 'PeterPortal API <peterportal.dev@gmail.com>',
      to: 'peterportal.dev@gmail.com',
    },
    locals: {
      apiKey: data['key'],
      appName: data['app_name'],
      unsubscribeURL: 'http://localhost:8080/unsubscribe/' + data['email']
    },
  }).then(() => console.log('email has been sent!'));
}

function generateApiKey() {
    var current_date = (new Date()).valueOf().toString();
    var random = Math.random().toString();
    return crypto.createHash('sha1').update(current_date + random).digest('hex');
}

module.exports = router;