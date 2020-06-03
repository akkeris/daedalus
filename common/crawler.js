const crypto = require('crypto');

function plural(object) {
  if (object.endsWith('ss')) {
    return `${object}es`;
  } if (object.endsWith('cy')) {
    return `${object.substring(0, object.length - 1)}ies`;
  } if (object.endsWith('ch') || object.endsWith('sh')) {
    return `${object}es`;
  }
  return `${object}s`;
}

async function createTableDefinition(pgpool, schema, name, columns = {}, references = []) {
  const query = `
  do $$
  begin
    create table if not exists ${schema}.${plural(name)}_log
    (
      node_log uuid not null primary key,
      node uuid not null,
      ${references.map((ref) => (typeof ref === 'string' ? `
      "${ref}" uuid references ${schema}.${plural(ref)}_log ("node_log"),
      ` : `
      "${ref.name}" uuid references ${schema}.${plural(ref.ref)}_log ("node_log"),
      `)).join('')}
      ${Object.keys(columns).map((column) => `
      "${column}" ${columns[column].type},
      `).join('')}
      definition jsonb not null,
      metadata jsonb not null,
      specification jsonb not null,
      status jsonb not null,
      hash varchar(64) not null,
      observed_on timestamp with time zone default now(),
      deleted boolean not null default false
    );
    create unique index if not exists ${plural(name)}_unique on "${schema}"."${plural(name)}_log" (hash, deleted);
    create index if not exists ${plural(name)}_node on "${schema}"."${plural(name)}_log" (node);
    create or replace view ${schema}.${plural(name)} as
      with ordered_list as ( 
        select
          node_log,
          node,
          ${references.map((ref) => (typeof ref === 'string' ? `
          "${ref}",
          ` : `
          "${ref.name}",
          `)).join('')}
          ${Object.keys(columns).map((column) => `
          "${column}",
          `).join('')}
          definition,
          metadata,
          specification,
          status,
          hash,
          observed_on,
          deleted,
          row_number() over (partition by node order by observed_on desc) as row_number
        from ${schema}.${plural(name)}_log
      )
      select 
        node_log,
        node,
        ${references.map((ref) => (typeof ref === 'string' ? `
        "${ref}",
        ` : `
        "${ref.name}",
        `)).join('')}
        ${Object.keys(columns).map((column) => `
        "${column}",
        `).join('')}
        definition,
        metadata,
        specification,
        status,
        hash,
        observed_on
      from ordered_list 
      where 
        row_number = 1 and 
        deleted = false;

      ${references.map((ref) => (typeof ref === 'string' ? `
      create index on "${schema}"."${plural(name)}_log" ("${ref}");
      ` : `
      create index on "${schema}"."${plural(name)}_log" ("${ref.name}");
      `)).join('')}

      comment on table "${schema}"."${plural(name)}_log" IS E'@name ${schema}${plural(name)}_log';
      comment on view "${schema}"."${plural(name)}" IS E'@name ${schema}${plural(name)}';
  end
  $$;
  `;
  await pgpool.query(query);
}

function computeHash(def) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(def));
  return hash.digest('hex');
}

async function writeDeletedObjs(pgpool, schema, name, nodes) {
  // Note: a `not in (...)` is used here, however we have a filter
  // to ensure no null values enter the list. TODO: change this to a safer NOT EXISTS and
  // stream node values to the table before running this query (for performance wins!)
  const query = `
  do $$
  begin
    create temporary table "${plural(name)}_temp" as select * from "${schema}"."${plural(name)}";
    alter table "${plural(name)}_temp" drop column node_log;

    insert into "${schema}"."${plural(name)}_log" 
      select uuid_generate_v4() as node_log, *, true as deleted
      from "${plural(name)}_temp" 
      ${nodes.length !== 0 ? `
      where node not in (${nodes.filter((x) => x !== null).map((x) => `'${x.node}'`).join(',')})
      ` : ''}
      on conflict (hash, deleted) do nothing;
      drop table "${plural(name)}_temp";
  end
  $$;
  `;
  await pgpool.query(query);
  return nodes;
}

function writeObj(pgpool, schema, name, node, definition, spec, status, metadata, columns = {}, references = {}) { // eslint-disable-line max-len
  const refColumns = Object.keys(references);
  const refNames = refColumns.length !== 0 ? `${refColumns.join(', ')},` : '';
  const refWithVals = refColumns.length !== 0 ? `${refColumns.map((x, i) => `q${i}.node_log`).join(',')},` : '';

  const colColumns = Object.keys(columns);
  const colNames = colColumns.length !== 0 ? `${colColumns.join(', ')},` : '';
  const colMapIndex = colColumns.length !== 0 ? `${colColumns.map((x, i) => `$${i + 2}`).join(', ')},` : '';

  const colCount = colColumns.length;

  const isNodeUUID = node.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) !== null;

  const query = `${refColumns.length !== 0 ? `
    with` : ''}${refColumns.map((ref, i) => `
    q${i} as ( select node_log from ${schema}.${plural(ref)}_log where ${Object.keys(references[ref]).map((refCol) => `${refCol} = '${references[ref][refCol]}'`)} )`).join(',')}
    insert into "${schema}"."${plural(name)}_log" (node_log, node, ${refNames} ${colNames} definition, metadata, specification, status, hash, observed_on, deleted)
    select 
      uuid_generate_v4(),
      ${isNodeUUID ? '$1' : 'uuid_generate_v5(uuid_ns_url(), $1)'},
      ${refWithVals}
      ${colMapIndex}
      $${colCount + 2},
      $${colCount + 3},
      $${colCount + 4},
      $${colCount + 5},
      $${colCount + 6},
      now(),
      false
    ${refColumns.length !== 0 ? `from ${refColumns.map((ref, i) => `q${i}`).join(', ')}` : ''}
    on conflict (hash, deleted)
    do update set deleted = false
    returning node_log, node, definition
  `;
  return pgpool.query(query, [node, ...colColumns.map((x) => columns[x]), definition, metadata, spec, status, computeHash(definition)]); // eslint-disable-line max-len
}

function wait(time) {
  return new Promise((res) => setTimeout(res, time));
}

module.exports = {
  wait,
  writeObj,
  writeDeletedObjs,
  createTableDefinition,
};
