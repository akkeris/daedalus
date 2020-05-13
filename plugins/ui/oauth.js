const axios = require('axios');
const jpath = require('json-path');

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

async function callback(pgpool, req, res) {
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
  if (process.env.OAUTH_USER_PROFILE_URL) {
    const { data: user, status: status2 } = await axios({
      method: 'get',
      url: `${process.env.OAUTH_USER_PROFILE_URL}`,
      headers: {
        'user-agent': 'daedalus', accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${req.session.token}`,
      },
    });
    if (status2 < 299 && status2 > 199 && user) {
      if (process.env.OAUTH_USER_ID_JSON_PATH) {
        req.session.username = jpath.resolve(user, process.env.OAUTH_USER_ID_JSON_PATH);
      } else if (user.id) {
        req.session.username = user.id;
      } else if (user.username) {
        req.session.username = user.username;
      }
      if (process.env.OAUTH_USER_AVATAR_JSON_PATH) {
        req.session.picture = jpath.resolve(user, process.env.OAUTH_USER_AVATAR_JSON_PATH);
      } else if (user.picture) {
        req.session.picture = user.picture;
      } else if (user.thumbnail) {
        req.session.picture = user.thumbnail;
      } else if (user.photo) {
        req.session.picture = user.photo;
      } else {
        req.session.picture = '/avatar.svg';
      }
      if (process.env.OAUTH_USER_EMAIL_JSON_PATH) {
        req.session.email = jpath.resolve(user, process.env.OAUTH_USER_EMAIL_JSON_PATH);
      } else if (user.email) {
        req.session.email = user.email;
      } else if (user.mail) {
        req.session.email = user.mail;
      } else {
        req.session.email = '';
      }
      if (process.env.OAUTH_USER_NAME_JSON_PATH) {
        req.session.name = jpath.resolve(user, process.env.OAUTH_USER_NAME_JSON_PATH);
      } else if (user.name) {
        req.session.name = user.name;
      } else {
        req.session.name = '';
      }
      if (process.env.OAUTH_USER_WEBSITE_JSON_PATH) {
        req.session.website = jpath.resolve(user, process.env.OAUTH_USER_WEBSITE_JSON_PATH);
      } else if (user.website) {
        req.session.profile_url = user.website;
      } else if (user.profile) {
        req.session.profile_url = user.profile;
      } else if (user.url) {
        req.session.profile_url = user.url;
      }
    } else {
      res.send(`Unable to access user profile data ${status2}`);
      return;
    }

    if (!req.session.name || !req.session.email || !req.session.username) {
      res.send(`Unable to fetch full profile, name: ${req.session.name} username: ${req.session.username} email: ${req.session.email}`);
      return;
    }

    const { rows: [{ system }] } = (await pgpool.query('select system from metadata.systems where name = \'daedalus\''));
    const { rows: [profile] } = await pgpool.query(`
      insert into metadata.users 
        ("user", username, name, email, system, photo_url, profile_url)
      values
        (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
      on conflict (username, system) 
      do update set name = $2, email = $3, photo_url = $5, profile_url = $6
      returning "user", username, name, email, system, photo_url, profile_url`,
    [req.session.username, req.session.name, req.session.email, system, req.session.picture || '/avatar.svg', req.session.profile_url || '#']);
    req.session.profile = profile;
  }
  res.redirect(req.session.redirect || '/');
}

module.exports = {
  check,
  callback,
};
