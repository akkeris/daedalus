# Contributing

## Running Locally

Define whichever environment settings above, then...

```
$ npm start
```

## Governance and Pull Reviews

This section helps outline what will be judged when submitting a pull review, this helps contributors know what to expect during a review:

1. Were code style guidelines followed (eslint), this is somewhat superficial but it helps keep the code base standard.
2. Were the principals outlined below used during the PRs development.
3. If dependencies were added, what security risk did it add to the overall footprint of the project.
4. If dependencies were added, what licensing issues may occur due to the dependency.
5. Was the pull request for a feature complete and useful? Major features or refactors should first have a request for comment from the maintainers, we don't want anyone putting a lot of effort into something then have it conflict with other requirements or goals of the project.
6. Did the author sign a CLA?
7. Did the test pass?
8. Does the PR significantly lower our code coverage, and does it have adequate tests?
9. If it adds a new dependency for a new service (e.g., the pull request now requires a graph database like cassandra to use daedalus) this should first be discussed with maintainers as it may put undo resource needs on all of our users. This is especially problematic if the same functionality could be accomplished with out.
10. Is the feature or plugin provide enough usefulness to the community to add? Pull request adding plugins that are proprietary to your company or use case won't be merged as it doesn't add value to anyone else.

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


## Understanding Nodes and Relationships

### Nodes

Nodes are an abstract concept of a specific object in daedalus. The specifics of a node are contained to the relevant plugin and irrelevant for most of the other abstract needs of daedalus.  Any plugin may register their node by creating a new record in `nodes.node_types` then subsequently adding nodes they find to the `metadata.nodes` table, and if their are relationships between nodes they can be recorded using one of the tables described below in the relationships section. 

Adding nodes to this immediately makes it available to graph search tools, notifications and searches.

### Common Fields

All "things" in daedalus have a `log` table that expresses the state of a node. It also contains a rolled up view with the latest state for convenience.  Each log table must have:

* `node_log` - This must express the individual uuid of the change, NOT the node.
* `node` - This must express the individual uuid of the node and be the same across all changes. 
* `name` - A globally unique name for the object no more than 256 characters and alpha numeric (can have dashes and periods).
* `definition` - A JSON object containing the raw definition of the node in question.
* `status` - A JSON object containing the raw status of the node in question.
* `observed_on` - The date and time when an observation was made. NOT the date a changed happened. 
* `deleted` - Whether the node was no longer there on the `observed_on` date/time.

If the raw definition or status contains the following, do not consider it as a change:

* The current time
* A system global version or lock

### Relationships

Anything that represents an infrastructural object (not a property or function or relationship) is consdiered a "node" and generically represented by the `metadata.nodes` table. This table must be updated and inserted into when any plug-in finds a new object of interest.  

In addition to the `metadata.nodes` table, relationships should be provided to daedalus by plug-ins. The plug-in is responsible for determining if the following relationships exist (and adding the record to the table necessary)

### Familial Relationships

Table: `metadata.families`

Nodes which have a concept of a parent and child (and thus cousin, sibling, etc) relationship should add itself to this table. When considering whether or not a node is a familial relationship consider:

1. A parent is defined as a node that is responsible for creating one or more other nodes. The nodes it creates is considered a child of that node. 
2. If more than one node is responsible for creating a node then both can be parents.  There can be any amount of parents or children.
3. A node may not exist in this relationship with a `NULL` parent.
4. A node may not exist in this relationship with a `NULL` child.
5. Do not assume that a parent child relationship exists if one node being deleted would imply another node must be removed. This is not a parent child relationship but a "ownership" relationship. While a child may be owned by a parent, this relationship only describes how an node was created.
6. Do not assume that a parent child relationship exists if one node depends on the other node. This is not a parent child relationship but a "dependency" relationship. While a child node may depend on a parent node, the parent child relationship only describes how a node was created.
7. Parent and child relationships cannot be cyclical.
8. If a node is a grant parent of another node it should not be recorded. Transient relatsionships should not be recorded unless the transient node is unavailable. 

### Dependency Relationships

Table: `metadata.dependencies`

Nodes which require another node in order to function, but NOT to exist are described as dependencies. When considering whether or not a node is a dependency relationship consider:

1. A node that depends on an other node does not imply that if one is deleted the other is deleted. This is a "ownership" relationship. A node could potentially be both dependent and owned however.
2. Not all parent and child relationships imply dependency. Parent child relationships describe how a node was created, dependency describe runtime needs.
3. Dependencies may be cyclical (although this is typical of bad design).
4. Dependencies are a directed graph, meaning node A is dependent on node B DOES NOT imply node B is dependent on node A.
5. A dependency implies if node A depends on node B then node A will not work if node B is removed.
6. Transient dependencies should not be recorded unless the transient node is unavialable and cannot be added to `metadata.nodes` table.  E.g., should Node A depend on node B which depends on node C, a record indicating node A depends on node C should not be added, UNLESS node B cannot be assertained or recorded.
7. When determining dependency, if a node becomes useless should another node be removed this is not a dependency but a node that may not need to exist.

### Ownership Relationships

Table: `metadata.ownerships`

Nodes which can only exist if another node exists are considered "owned" by that node.  This is the case in situations like a column in a database table, where if the table is removed the column cannot survive. Consider the following before adding a node as "owned":

1. A node that depends on another node but can potentially exist outside of that node is not "owned" by that node. This relationship is a dependency.
2. A node that was created by another node but can exist the life-cycle of the node that created it is not "owned" by that node. This relationship is familial.
3. An ownership relationship cannot be cyclical.

### Orphaned Nodes

Any nodes with no relationships to any other nodes are inherently considered orphaned as either A) the relationship cannot be defined or B) there is no relationship and the node should not exist. 


site -> app -> database as dependency


site -(depends on)-> app -(parent of && owns)-> kube deploy -(depends on)-> role -(depends on)-> database
														   '-(owns && parent of)-> replicaset -(depends on)-> role -(depends on)-> database
														   						'-(owns && parent of)-> pod -(depends on)-> role -(depends on)-> database




