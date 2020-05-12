const { grab, findUses } = require('./common.js');

async function basicSearch(pgpool, query, limit = 10) {
  return (await pgpool.query(`
        select 
          nodes.node as id,
          case 
            when labels.value is null then nodes.name
            else labels.value
          end as title,
          '/ui/search/?node=' || nodes.node || '&q=' as location,
          node_types.icon,
          nodes.definition,
          nodes.status,
          node_types.name as type,
          case
            when annotations.value is null and labels.value is not null then nodes.name
            else annotations.value
          end as text
        from 
          metadata.nodes
            join metadata.node_types on nodes.type = node_types.type
            left join metadata.annotations on annotations.name = 'description' and annotations.node = nodes.node
            left join metadata.labels on labels.name = 'name' and labels.node = nodes.node
        where
          nodes.name like $1 or
            (labels.value is not null and labels.value like $1) or
            (annotations.value is not null and annotations.value like $1)
        order by
          case node_types.name 
            when 'postgresql/databases' then 100
            when 'oracle/databases' then 100
            when 'akkeris/sites' then 90
            when 'akkeris/apps' then 90
            when 'kubernetes/deployments' then 80
            when 'akkeris/routes' then 70
            else 50
          end desc
        limit ${limit}
      `, [`%${query}%`])).rows.map((x) => ({ ...x, location: x.location + encodeURIComponent(query) }));
}

module.exports = function expressRegister(pgpool) {
  return {
    searchAPI: async function searchAPI(req, res) {
      // we need to implement a more sophisticated
      // search than just a like with manual ordering.
      res.send(await basicSearch(pgpool, req.query.q));
    },
    searchUI: async function searchUI(req, res, next) {
      const nodes = await basicSearch(pgpool, req.query.q);
      if (nodes.length === 0 && !req.query.node) {
        grab('./views/no-search-results.html', req, res, next);
        return;
      }
      if (!req.query.node) {
        req.query.node = nodes[0].id; // assume the first result is the one we were looking for.
      }
      const client = await pgpool.connect();
      let closed = false;
      req.on('close', () => {
        if (!closed) {
          closed = true;
          client.release(true);
        }
      });
      const { rows: [data] } = (await client.query(`
        select
          node,
          name,
          human_name,
          type,
          definition,
          status,
          observed_on,
          labels,
          annotations
        from
          metadata.objects
        where node = $1
      `, [req.query.node]));
      /*
       * Get all of the items that have this as a dependency (in-directly or directly)
       * Then group them by type and order them by amount (or maybe last used?)
       */
      const { rows: dependents } = (await client.query('select * from metadata.find_ancestors($1)', [req.query.node]));
      grab('./views/search.html', req, res, next, {
        ...data, dependents, dependencies: await findUses(pgpool, req.query.node), nodes,
      });
      if (!closed) {
        closed = true;
        client.release(false);
      }
    },
  };
};
