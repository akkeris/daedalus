# Daedalus 

**Cunningly Wrought**

[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8955d795526c43c5baa797e11bb2dfe3)](https://www.codacy.com/gh/akkeris/daedalus?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=akkeris/daedalus&amp;utm_campaign=Badge_Grade)

Daedalus is a knowledge system intended for collecting an examining resources on systems.

> This is currently in discovery and may change considerably.

## Installation

Daedalus requires a postgresql database (with superuser permissions) to store data. The docker image `akkeris/daedalus:latest` or `akkeris/daedalus:[release]` can be deployed with the following environment variables set.

 *  `DATABASE_URL` - This is the database used for daedalus.
 *  `SECRET` - This is the secret key used to encrypt data with an aes192 encryption. It must be 24 bytes long.
 *  `HASH_SECRET` - This is the secret key used in the hmac process to create a hash, it should be different from `SECRET`.
 *  `ENVS_BLACKLIST` - Optional - This is a comma sepearted list of substrings that if found as the key or value will be redacted when stored. Defaults to `PASS,KEY,SECRET,PRIVATE,TOKEN,SALT,AUTH,HASH`.

### Setting up GraphQL

GraphQL API can be configured and turned on independently (infact you can start up daedalus with only the web GraphQL end point exposed and have workers running to collect information on other systems).  To enable the GraphQL API add the environment variables:

 *  `GRAPHQL_API` - Set this value to `true` to enable the http web process.
 *  `PORT` - Set this to the value of the port to listen to for the web process, if this is not set it defaults to port `9000`.

### Setting up Kubernetes

To listen to one or more kubernetes clusters, deploy daedalus to multiple clusters. Configuring kubernetes can be done multiple ways:

 1. Through a service account in the deployment and when `KUBERNETES_CONTEXT` is set. 
 2. Through the `$HOME/.kube` kubectl config file and when `KUBERNETES_CONTEXT` is set.
 3. Through explicit environment varialbes below.

 *  `KUBERNETES_CONTEXT` - This indicates the kubernetes cluster and user being used. This must be set if you want to crawl a kubernetes cluster.
 *  `KUBERNETES_TOKEN` - This should only be set if you want to override looking for a service account or using the local kubectl configuration.
 *  `KUBERNETES_API_URL` - This should only be set if you want to override looking for a service account or using the local kubectl configuration.

The service account or RBAC access levels for Daedalus must permit read and watch access to pods, servies, nodes, configmaps, persistent volumes, persistent volume claims, events, deployments and ingresses. If istio is installed it should also permit read and watch access to virtual services, gateways and policies.  If cert-manager is installed also permit orders, certificates, challenges and certificaterequests. 

Values typically stored in annotations, environment variables (both for pods, deployments and replicasets) in addition to values in config maps are redacted if the value or key indicates it may be sensitive in nature.  See the `redact` function in `common/security.js` and `ENV_BLACKLIST` environment variable for more information.

Note that using https with self-signed (insecure) certificates or authenticating with mutual TLS authentication with kubernetes is not supported.

### Setting up Akkeris

Daedalus can optionally crawl Akkeris for sites, apps, etc. To setup akkeris the following environment variables must be set. This will crawl all regions in akkeris.

 *  `AKKERIS_URL` - The apps URL for akkeris. (e.g., `https://apps.example.com`)
 *  `AKKERIS_TOKEN` - A JWT token from akkeris.

### Setting up AWS RDS

 *  `AWS_RDS_SECRET_KEY` - The IAM secret key that must have access to list and describe RDS instances.
 *  `AWS_RDS_ACCESS_KEY` - The IAM access key id that must have access to list and describe RDS instances.
 *  `AWS_RDS_REGIONS` - A comma delimited list of regions to crawl for RDS instances.

## Debugging

To debug, set the environment variable `DEBUG=daedalus:*`, to debug specific sections use the values:

 *  `daedalus:index` - main functionality
 *  `daedalus:postgresql` - postgresql importing and checks.
 *  `daedalus:kubernetes` - kubernetes debugging, importing and checks.
 *  `daedalus:akkeris` - akkeris debugging, importing and checks.
 *  `daedalus:aws` - aws debugging, importing and checks.

## Running Locally

Define whichever environment settings above, then...

```
$ npm start
```

## Contributing

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
