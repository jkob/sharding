# Shortener

A small project for learning [database sharding](en.wikipedia.org/wiki/Sharding).
 

This project has 3 endpoints:
| Endpoint | Action |
|----------|--------|
| GET /        | Lists results from all DBs |
| GET /:token  | Redirects to fetched URL |
| POST /?url= | Hashes and stores the URL query-param in a DB |

## Sharding

The concept of sharding is quite complex, and can have disasterous outcomes if done incorrectly.

The key to sharding lies in consistenct hashing. In order to distribute the tokens, `hashring` is utilized. To get consistent hashing from the module, we need to have a standard way of "translating" URLs. Hence, we do the following.

Sharding recipe:

1. Hashing the URL + random int (0-10000) with sha256
2. Encoded using base64
3. Substring the first 8 chars
4. Use the hashring to fetch where to store

This recipe allows for 68,719,476,736 unique tokens.


## Tech

This project is built using the following tech:
- Koa
- koa-router
- hashring
- Knex
- SQLite3
- Typescript



