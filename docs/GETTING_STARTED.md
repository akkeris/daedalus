## Installation

### Overview

Daedalus can be deployed with a docker image from [https://hub.docker.com/r/akkeris/daedalus/tags](akkeris/daedalus). At a bare minimum the following environment variables must be set.  Daedalus has a variety of modules that can be enabled or disabled (even the UI) via each section below. Daedalus is designed to allow anyone plugin or plugins to run together as one process giving it flexibility (for instance should you want to scan multiple kubernetes instances, run multiple daedalus instances with the same database but only the kubernetes module enabled). Daedalus requires an open port only for the UI or GraphQL API. Daedalus does not require any persistent volumes.

### Prerequisetes

* Postgresql 12+
* Node 12+

### Required Environment Varaibles

 *  `DATABASE_URL` - This is the database used for daedalus. 
 *  `SECRET` - This is the secret key used to encrypt data with an aes192 encryption. It must be 24 bytes long.
 *  `HASH_SECRET` - This is the secret key used in the hmac process to create a hash, it should be different from `SECRET`.
 *  `ENVS_BLACKLIST` - Optional - This is a comma sepearted list of substrings that if found as the key or value will be redacted when stored. Defaults to `PASS,KEY,SECRET,PRIVATE,TOKEN,SALT,AUTH,HASH`.
 *  `PORT` - Set this to the value of the port to listen to for the web process (used by either the UI or GraphQL), if this is not set it defaults to port `9000`, note if the graphql or ui plugin are both disabled a port is not opened.
 *  `SKIP_MAINTENANCE` - This prevents daedalus from preforming database re-indexing and other maintenance tasks every 24 hours.
 *  `SMTP` - The smtp server to use (in the format smtp://mail.example.com:25 or smtps:// for secure smtp, login information can also be specified using smtps://user:pass@mail.example.com).  Optional, if not specified notifications won't run.
 *  `SMTP_FROM` - The email address the SMTP from should use (e.g., daedalus@example.com).  Optional, if not specified notifications won't run.

### UI Plugin

 *  `UI` - Set this value to `true` to enable the UI web process.
 *  `SESSION_SECRET` - The secret to use for encrypting the session id in the browser. If not set, this will default to `HASH_SECRET`.
 *  `OAUTH_AUTHORIZE_URL` - The end point for beginning the oauth client redirect flow `/authorize`
 *  `OAUTH_ACCESS_TOKEN_URL` - The end point to exchange the authorizatoin code for an access token, typically, `/access_token`
 *  `OAUTH_SCOPES` - Any necessary scopes to add to the authorization request (if needed).
 *  `OAUTH_CLIENT_URI` - The URI that should be provided as the redirect in the authorization_code, this is typically the url for daedalus (e.g., `https://daedalus.example.com/oauth/callback`)
 *  `OAUTH_CLIENT_ID` - The client id provided by the oauth system.
 *  `OAUTH_CLIENT_SECRET` - The client secret provided by the oauth system.
 *  `OAUTH_USER_PROFILE_URL` - Must return a json object containing users information with token obtained through oauth flow.
 *  `OAUTH_USER_AVATAR_JSON_PATH` - Json path in profile object to avatar url. 
 *  `OAUTH_USER_EMAIL_JSON_PATH` - Json path in profile object to email.
 *  `OAUTH_USER_NAME_JSON_PATH` - Json path in profile object to name.
 *  `OAUTH_USER_ID_JSON_PATH` - JSON path in profile object to a unique id representing the user.

 Note that session information is stored in the `public` schema in the table `session`.

### GraphQL Plugin

GraphQL API can be configured and turned on independently (infact you can start up daedalus with only the web GraphQL end point exposed and have workers running to collect information on other systems).  To enable the GraphQL API add the environment variables:

 *  `GRAPHQL_API` - Set this value to `true` to enable the http web process. Postgraphile information is written to the `postgraphile_watch` schema.
 *  `GRAPHQL_POSTGRAPHILE_OPTIONS` - Sets options for the GraphQL API (https://www.graphile.org/postgraphile/usage-library/#recommended-options)

Because session information is stored in the `public` schema we exclude it from analysis by default.

### Metadata Plugin

The metadata plugin is generally required if you want to use the UI or GraphQL, it analyzes incoming objects from various other plugins and creates link relationships between them. 

*  `METADATA` - Set this to `true` to enable examining systems for links (highly recommended).

### Github Plugin

The github plugin will scan repos that it finds in use. To enable this:

* `GITHUB` - Set this to `true` to enable examining github repos found.
* `GITHUB_TOKEN` - Set this to a github API token that has read permissions to potentially any repo it finds.

### Urls Plugin

This plugin examines urls (and certificates) it finds in various places and records information about them. 

* `URLS` - Set this to `true` to enable examining urls (highly recommended).

### Postgresql Plugin

 *  `POSTRESQL` - Set this value to `true` to enable scanning postgres databases for schema changes and statistics.
 *  `POSTGRESQL_HISTOGRAM` - Set this to `true` to enable column level histograms, this may collect data from scanned databases, because of this it's disabled by default.

### Oracle Plugin

 *  `ORACLE` - Set this value to `true` to enable scanning oracle databases for schema changes and statistics.
 *  `ORACLE_HISTOGRAM` - Set this to `true` to enable column level histogram samples, this may collect data from scanned databases. because of this it's disabled by default.

 To use the oracle plugin you'll need to generate your own Dockerfile image due to licensing restrictions on oracle drivers. 

 1. To generate an oracle image clone this repo down `git clone https://github.com/akkeris/daedalus`.
 2. Download the `Basic Package (ZIP)` 19.6.X binaries from https://www.oracle.com/database/technologies/instant-client/linux-x86-64-downloads.html
 3. Unzip and place the unzipped directories at the root of the cloned repo
 4. Run `docker build -t [what tag youd like] . -f ./Dockerfile.oracle`

 For more information see https://oracle.github.io/node-oracledb/doc/api.html#getstarted

### Kubernetes Plugin

To listen to one or more kubernetes clusters, deploy daedalus to multiple clusters. Configuring kubernetes can be done multiple ways:

*  `KUBERNETES` - This must be set to "true" in order for the kuberentes plugin to be enabled.

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

To generate a service account:

```
kubectl --context [context] -n default apply ./support/r8-roles.yaml
export SECRET_NAME=`kubectl get serviceaccount/daedalus -n default -o=jsonpath='{.secrets[0].name}'`
export KUBERNETES_TOKEN=`kubectl --context ds1 get secrets/$SECRET_NAME -o jsonpath='{.data.token}' -n default | base64 -D` 
echo $KUBERNETES_TOKEN
```

### Istio Plugin

This requires the kubernetes plugin, otherwise it will not function.

* `ISTIO` - Set this to `true` to enable istio virtual service, policy and gateway scanning.

### Cert Manager Plugin

This requires the kubernetes plugin, otherwise it will not function.

* `CERT_MANAGER` - Set this to `true` to enable cert manager certificate scanning (note this isn't the private key just the certificate information thats scanned).

### Akkeris Plugin

*  `AKKERIS` - Must be set to "true" in order to enable the akkeris plugin.

Daedalus can optionally crawl Akkeris for sites, apps, etc. To setup akkeris the following environment variables must be set. This will crawl all regions in akkeris.

 *  `AKKERIS_URL` - The apps URL for akkeris. (e.g., `https://apps.example.com`)
 *  `AKKERIS_TOKEN` - A JWT token from akkeris.

### AWS RDS Plugin

 *  `AWS` - This must be set to `true` in order to enable AWS scanning.
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
 *  `daedalus:metadata` - turn on debugging for module that attempts to classify with labels and annotations.
 *  `daedalus:oracle` - turn on debugging for oracle scanning.
 *  `daedalus:aws` - aws debugging, importing and checks.
 *  `daedalus:urls` - turns on debugging for urls.
 *  `daedalus:graphql` - Turns on debugging for graphql.
 *  `daedalus:ui` - Turns on debugging for the UI.

