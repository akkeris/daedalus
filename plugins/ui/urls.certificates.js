const {
  grab, findUses, findUsedBy, findMetaData, isFavorite,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('certificate_id', async (req, res, next) => {
    const { rows: certificates } = await pgpool.query('select * from urls.certificates where certificate_log::varchar(128) = $1', [req.params.certificate_id]);
    if (certificates.length !== 1) {
      delete req.params.urls_id;
      res.sendStatus(404);
      return;
    }
    req.params.certificate = certificates[0]; // eslint-disable-line prefer-destructuring
    req.params.certificate_id = certificates[0].certificate_log;
    req.params.node = certificates[0].certificate_log;
    next();
  });
  app.get('/ui/urls/certificates/:certificate_id', async (req, res, next) => {
    const { rows: changes } = await pgpool.query(`
      select 
        'certificates' as "$type",
        'certificate' as "$icon",
        certificates_log.certificate_log as id,
        certificates_log.deleted,
        certificates_log.observed_on,
        certificates_log.subject as name
      from 
        urls.certificates_log
      where
        certificates_log.certificate_log = $1
    `, [req.params.certificate_id]);
    const data = {
      ...req.params.certificate,
      ...(await findMetaData(pgpool, req.params.certificate_id)),
      changes,
      usedBy: await findUsedBy(pgpool, req.params.certificate_id),
      uses: await findUses(pgpool, req.params.certificate_id),
      users: await usersAndWatchers(pgpool, req.params.certificate_id),
      favorite: req.session.profile ? await isFavorite(pgpool, req.params.node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/urls.certificates.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'urls/certificates', 'certificate_id');
};
