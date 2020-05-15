const {
  grab, findUses, findUsedBy, findMetaData, isFavorite,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('urls_id', async (req, res, next) => {
    const { rows: urls } = await pgpool.query('select * from urls.urls where url_log::varchar(128) = $1', [req.params.urls_id]);
    if (urls.length !== 1) {
      delete req.params.urls_id;
      res.sendStatus(404);
      return;
    }
    req.params.urls = urls[0]; // eslint-disable-line prefer-destructuring
    req.params.urls_id = urls[0].url_log;
    req.params.node = urls[0].url_log;
    next();
  });
  app.get('/ui/urls/urls/:urls_id', async (req, res, next) => {
    const { rows: changes } = await pgpool.query(`
      select 
        'urls' as "$type",
        'url' as "$icon",
        urls_log.url_log as id,
        urls_log.deleted,
        urls_log.observed_on,
        urls_log.protocol || '//' || urls_log.hostname || urls_log.pathname as name
      from 
        urls.urls_log
      where
        urls_log.url_log = $1
    `, [req.params.urls_id]);
    const data = {
      ...req.params.urls,
      ...(await findMetaData(pgpool, req.params.urls_id)),
      changes,
      usedBy: await findUsedBy(pgpool, req.params.urls_id),
      uses: await findUses(pgpool, req.params.urls_id),
      users: await usersAndWatchers(pgpool, req.params.urls_id),
      favorite: req.session.profile ? await isFavorite(pgpool, req.params.node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/urls.urls.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'urls/urls', 'urls_id');
};
