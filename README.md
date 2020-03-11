# Daedalus 

**Cunningly Wrought**

Daedalus is a knowledge system intended for collecting an examining resources on systems.

This is currently in discovery and may change considerably.

## Environment

* `DATABASE_URL` - Required - This is the database used for daedalus.
* `KUBERNETES_CONTEXT` - Optional - This is used to indicate the instance of kubernetes context being used.
* `AKKERIS_URL` and `AKKERIS_TOKEN` - Optional - this is used to query akkeris.

## Debug

To debug, set the environment variable `DEBUG=daedalus:*`, to debug specific sections use the values:

* `daedalus:index` - main functionality
* `daedalus:postgresql` - postgresql importing and checks.
* `daedalus:kubernetes` - kubernetes debugging, importing and checks.
* `daedalus:akkeris` - akkeris debugging, importing and checks.

## Contributing

Please follow the conventions and principals below when contributing.

### Fail and quit on error

Unless you expect and plan on handling an error, any error should immediately cause daedalus to quit. This is fine, the hosting platform should retain the logs and restart daedalus during exceptions. Don't spend time trying to handle errors you can't intentionally and safely recover from.

### No hidden (or private) interfaces

Everything in daedalus writes and reads to the posgresql database as a source of truth. This database is a first class interface, meaning at any point someone should and could modify the data and any portion of daedalus should be smart enough (and resilent enough) to react to the change.  For example, populating the `postgresql.databases` table with a new postgres database should be picked up and cause a scan of the database.

This also means any data integrity should be enforced at the database level. NOT within code, using custom postgresql types is a great way of doing this (or using constraints or checks).

### Follow the linter

For code standards please just follow eslint (run `eslint . --fix` after commiting to check code style). Install eslint with `npm -g install eslint`)

### Manage creation and migrations 

Creating and migrating schemas should be a first class citizen of each component in daedalus, on init a create.sql script should always be ran that checks to current schema or tables available and if they do not exist, create or modify them. This helps ease maintenance burden and create safer code.

### Plan for n+1

Do not create system or software that must explicitly be started in a certain order or that requires a specific amount of something. This only leads to unscalable and unmaintainable software. Write code with the assumption that more than one could be running at any point. 

### Plan for interruption at any point

Plan for software to be restarted or interrupted at any point.  It should gracefully recover from interruptions (like a restart) and continue processing. Do not store explicit state in the database. Do not store configuration in the database.