# Contributing

## Running Locally

Define whichever environment settings above, then...

```
$ npm start
```

## Principals

Please follow the conventions and principals below when contributing.

### Fail and quit on error

Unless you expect and plan on handling an error, any error should immediately cause daedalus to quit. This is fine, the hosting platform should retain the logs and restart daedalus during exceptions. Don't spend time trying to handle errors you can't intentionally and safely recover from.

### No hidden (or private) interfaces

Everything in daedalus writes and reads to the posgresql database as a source of truth. This database is a first class interface, meaning at any point someone should and could modify the data and any portion of daedalus should be smart enough (and resilent enough) to react to the change.  For example, populating the `postgresql.databases` table with a new postgres database should be picked up and cause a scan of the database.

This also means any data integrity should be enforced at the database level. NOT within code, using custom postgresql types is a great way of doing this (or using constraints or checks).

### What is your source of truth

Always be aware of what is a source of truth and what is a cache or copy. This is important when determing if an object has been created or removed as the source of truth must be first pulled then iterated against a cache or copy. Mistaking a table or schema as a source of truth when its just a copy may lead to logical errors. (e.g., postgresql.databases schema is not a source of truth, its a copy of databases found from crawling other systems, however AWS RDS is a source of truth for any database found that happens to be an RDS instance).

### Follow the linter

For code standards please just follow eslint (run `eslint . --fix` after commiting to check code style). Install eslint with `npm -g install eslint`) After you've installed eslint globally you can add eslint to your git-hooks by running `cat ./support/git-hooks/pre-commit >> ./.git/hooks/pre-commit`

### Manage creation and migrations 

Creating and migrating schemas should be a first class citizen of each component in daedalus, on init a create.sql script should always be ran that checks to current schema or tables available and if they do not exist, create or modify them. This helps ease maintenance burden and create safer code.

### Plan for n+1 and no-ordering

Do not create system or software that must explicitly be started in a certain order or that requires a specific amount of something. This only leads to unscalable and unmaintainable software. Write code with the assumption that more than one could be running at any point. 

### Plan for interruptions

Plan for software to be restarted or interrupted at any point.  It should gracefully recover from interruptions (like a restart) and continue processing. Do not store runtime state (like progress or work queues) in the database. Do not store configuration in the database.

### Plan for security

* Never output values or metadata about objects being crawled (even in debug mode). Only output keys created by daedalus (uuids), hashes, counts or actions daedalus is performing. This helps ensure sensitive information is not leaked.
* Encrypt anything sensitive using the functions in the library `common/security.js` as it helps prevent making mistakes with encryption and decryption.  Before encrypting consider how the same task could be accomplished without storing sensitive information. Encrypted information should be stored as a `jsonb` type in postgres.
* Hash values using the hmac or redact function in `common/security.js`, if there's even a slight possibility that the values you're storing could potentially store sensitive information. The hash value will help indicate if the value has changed (even if the value is unavailable).
* Always consider what would happen if the data stored became public on the internet.
