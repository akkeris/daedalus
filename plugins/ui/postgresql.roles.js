const {
  grab, findUses, findUsedBy, findMetaData, isFavorite, findChanges,
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
    req.params.node = roles[0]; // eslint-disable-line prefer-destructuring
    req.params.node.node = req.params.node.role;
    req.params.node.node_log = req.params.node.role_log;
    next();
  });
  app.get('/ui/postgresql/roles/:postgresql_role_id', async (req, res, next) => {
    const { rows: roles } = await pgpool.query('select * from postgresql.roles where role_log = $1', [req.params.node.node_log]);
    const { rows: databases } = await pgpool.query('select * from postgresql.databases where database_log = $1', [roles[0].database_log]);
    const { node } = req.params.node;
    const { node_log } = req.params.node; // eslint-disable-line camelcase
    const data = {
      node,
      node_log,
      ...req.params.postgresql_role,
      databases,
      roles,
      ...(await findMetaData(pgpool, node)),
      changes: (await findChanges(pgpool, node)),
      usedBy: await findUsedBy(pgpool, node_log),
      uses: await findUses(pgpool, node_log),
      users: await usersAndWatchers(pgpool, node),
      favorite: req.session.profile ? await isFavorite(pgpool, node, req.session.profile.user) : null, // eslint-disable-line max-len
    };

    grab('./views/postgresql.roles.html', req, res, next, data);
  });
  await addExpressAnnotationsAndLabelRoutes(pgpool, app, 'postgresql/roles', 'postgresql_role_id');
};
