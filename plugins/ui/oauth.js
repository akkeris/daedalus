const axios = require('axios');

function redirect(req, res) {
  req.session.redirect = req.originalUrl;
  if (process.env.OAUTH_SCOPES) {
    res.redirect(`${process.env.OAUTH_AUTHORIZE_URL}?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${process.env.OAUTH_CLIENT_URI}`)}&scope=${encodeURIComponent(process.env.OAUTH_SCOPES)}`);
  } else {
    res.redirect(`${process.env.OAUTH_AUTHORIZE_URL}?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(`${process.env.OAUTH_CLIENT_URI}`)}`);
  }
}

function check(req, res, next) {
  if (!req.session.token) {
    redirect(req, res);
  } else {
    next();
  }
}

async function callback(req, res) {
  if (!req.query.code) {
    res.send('Uh oh, an authorization code wasn\'t returned.');
    return;
  }
  const { data, status } = await axios({
    method: 'post',
    url: `${process.env.OAUTH_ACCESS_TOKEN_URL}`,
    headers: { 'user-agent': 'daedalus', accept: 'application/json' },
    data: `client_id=${process.env.OAUTH_CLIENT_ID}&client_secret=${process.env.OAUTH_CLIENT_SECRET}&code=${req.query.code}&grant_type=authorization_code`,
  });
  if (status !== 200 && status !== 201) {
    res.send('Uh oh, the authorization code exchange failed.');
    return;
  }
  req.session.token = data.access_token;
  res.redirect(req.session.redirect || '/');
}

module.exports = {
  check,
  callback,
};
