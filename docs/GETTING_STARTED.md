## Installation

### Overview

Daedalus can be deployed with a docker image from [https://hub.docker.com/r/akkeris/daedalus/tags](akkeris/daedalus). At a bare minimum the following environment variables must be set.  Daedalus has a variety of modules that can be enabled or disabled (even the UI) via each section below. Daedalus is designed to allow anyone plugin or plugins to run together as one process giving it flexibility (for instance should you want to scan multiple kubernetes instances, run multiple daedalus instances with the same database but only the kubernetes module enabled). Daedalus requires an open port only for the UI or GraphQL API. Daedalus does not require any persistent volumes.

### Required Environment Varaibles

 *  `DATABASE_URL` - This is the database used for daedalus. 
 *  `SECRET` - This is the secret key used to encrypt data with an aes192 encryption. It must be 24 bytes long.
 *  `HASH_SECRET` - This is the secret key used in the hmac process to create a hash, it should be different from `SECRET`.
 *  `ENVS_BLACKLIST` - Optional - This is a comma sepearted list of substrings that if found as the key or value will be redacted when stored. Defaults to `PASS,KEY,SECRET,PRIVATE,TOKEN,SALT,AUTH,HASH`.
 *  `PORT` - Set this to the value of the port to listen to for the web process (used by either the UI or GraphQL), if this is not set it defaults to port `9000`, note if the graphql or ui plugin are both disabled a port is not opened.

### UI Plugin

 *  `UI` - Set this value to `true` to enable the UI web process.
 *  `SESSION_SECRET` - The secret to use for encrypting the session id in the browser. If not set, this will default to `HASH_SECRET`.
 *  `OAUTH_AUTHORIZE_URL` - The end point for beginning the oauth client redirect flow `/authorize`
 *  `OAUTH_ACCESS_TOKEN_URL` - The end point to exchange the authorizatoin code for an access token, typically, `/access_token`
 *  `OAUTH_SCOPES` - Any necessary scopes to add to the authorization request (if needed).
 *  `OAUTH_CLIENT_URI` - The URI that should be provided as the redirect in the authorization_code, this is typically the url for daedalus (e.g., `https://daedalus.example.com/oauth/callback`)
 *  `OAUTH_CLIENT_ID` - The client id provided by the oauth system.
 *  `OAUTH_CLIENT_SECRET` - The client secret provided by the oauth system.

 Note that session information is stored in the `public` schema in the table `session`.

### GraphQL Plugin

GraphQL API can be configured and turned on independently (infact you can start up daedalus with only the web GraphQL end point exposed and have workers running to collect information on other systems).  To enable the GraphQL API add the environment variables:

 *  `GRAPHQL_API` - Set this value to `true` to enable the http web process. Postgraphile information is written to the `postgraphile_watch` schema.
 *  `GRAPHQL_POSTGRAPHILE_OPTIONS` - Sets options for the GraphQL API (https://www.graphile.org/postgraphile/usage-library/#recommended-options)

Because session information is stored in the `public` schema we exclude it from analysis by default.

### Postgresql Plugin

 *  `POSTRESQL` - Set this value to `true` to enable scanning postgres databases for schema changes and statistics.

### Kubernetes Plugin

To listen to one or more kubernetes clusters, deploy daedalus to multiple clusters. Configuring kubernetes can be done multiple ways:

 1. Through a service account in the deployment and when `KUBERNETES_CONTEXT` is set. 
 2. Through the `$HOME/.kube` kubectl config file and when `KUBERNETES_CONTEXT` is set.
 3. Through explicit environment varialbes below.

 *  `KUBERNETES_CONTEXT` - This indicates the kubernetes cluster and user being used. This must be set if you want to crawl a kubernetes cluster.
 *  `KUBERNETES_TOKEN` - This should only be set if you want to override looking for a service account or using the local kubectl configuration.
 *  `KUBERNETES_API_URL` - This should only be set if you want to override looking for a service account or using the local kubectl configuration.
 *  `KUBERNETES_SKIP_TLS_VERIFY` - This should only be set if you want to ignore security warnings for self-signed certificates.

The service account or RBAC access levels for Daedalus must permit read and watch access to pods, servies, nodes, configmaps, persistent volumes, persistent volume claims, events, deployments and ingresses. If istio is installed it should also permit read and watch access to virtual services, gateways and policies.  If cert-manager is installed also permit orders, certificates, challenges and certificaterequests.  See `support/kubernetes-service-account.yaml` for an example service account.

Values typically stored in annotations, environment variables (both for pods, deployments and replicasets) in addition to values in config maps are redacted if the value or key indicates it may be sensitive in nature.  See the `redact` function in `common/security.js` and `ENV_BLACKLIST` environment variable for more information.

Note that using https with self-signed (insecure) certificates or authenticating with mutual TLS authentication with kubernetes is not supported.

### Akkeris Plugin

Daedalus can optionally crawl Akkeris for sites, apps, etc. To setup akkeris the following environment variables must be set. This will crawl all regions in akkeris.

 *  `AKKERIS_URL` - The apps URL for akkeris. (e.g., `https://apps.example.com`)
 *  `AKKERIS_TOKEN` - A JWT token from akkeris.

### AWS RDS Plugin

 *  `AWS_RDS_SECRET_KEY` - The IAM secret key that must have access to list and describe RDS instances.
 *  `AWS_RDS_ACCESS_KEY` - The IAM access key id that must have access to list and describe RDS instances.
 *  `AWS_RDS_REGIONS` - A comma delimited list of regions to crawl for RDS instances.

## Debugging

To debug, set the environment variable `DEBUG` with one of the values below.

 *  `daedalus:*` - enable all modules debugging.
 *  `daedalus:index` - main functionality
 *  `daedalus:postgresql` - postgresql importing and checks.
 *  `daedalus:kubernetes` - kubernetes debugging, importing and checks.
 *  `daedalus:akkeris` - akkeris debugging, importing and checks.
 *  `daedalus:links` - turn on debugging for module that attempts to establish links between various objects.
 *  `daedalus:metadata` - turn on debugging for module that attempts to classify with labels and annotations.
 *  `daedalus:aws` - aws debugging, importing and checks.

