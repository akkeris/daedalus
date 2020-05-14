const {
  grab, findUses, findUsedBy, findMetaData, isFavorite,
  usersAndWatchers, addExpressAnnotationsAndLabelRoutes,
} = require('./common.js');

module.exports = async function addExpressRoutes(pgpool, bus, app) {
  app.param('postgresql_role_id', async (req, res, next) => {
    const { rows: roles } = await pgpool.query('select * from postgresql.roles where (role::varchar(128) = $1 or username::varchar(128) = $1)', [req.params.postgresql_role_id]);
    if (roles.length !== 1) {
      delete req.params.postgresql_role_id;
      res.sendStatus(404);
      return;
    }
    req.params.postgresql_role = roles[0]; // eslint-disable-line prefer-destructuring
    req.params.postgresql_role_id = roles[0].role;
    req.params.node = roles[0].role;
    next();
  });
  app.get('/ui/postgresql/roles/:postgresql_role_id', async (req, res, next) => {
    const { rows: roles } = await pgpool.query('select * from postgresql.roles where role = $1', [req.params.postgresql_role_id]);
    const { rows: databases } = await pgpool.query('select * from postgresql.databases where database = $1', [roles[0].database]);
    const { rows: changes } = await pgpool.query(`
      select 
        'user' as "$icon",
        username as name,
        'role' as "$type",
        deleted,
        observed_on
      from
        postgresql.roles_log
      where
        database = $1 and username = $2`,
    [roles[0].database, roles[0].username]);

    const data = {
      ...req.params.postgresql_role,
      ...(await findMetaData(pgpool, req.params.postgresql_role_id)),
      changes,
      databases,
      roles,
      usedBy: await findUsedBy(pgpool, req.params.postgresql_role_id),
      uses: await findUses(pgpool, req.params.postgresql_role_id),
      users: await usersAndWatchers(pgpool, req.params.postgresql_role_id),
      favorite: req.session.profile ? await isFavorite(pgpool, req.params.node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/postgresql.roles.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'postgresql/roles', 'postgresql_role_id');
};
