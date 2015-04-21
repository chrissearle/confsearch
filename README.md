# JavaZone Indexer

To start ElasticSearch locally - run

```
elasticsearch --config=config/elasticsearch.yml
```

Still to be done:

* Make elasticsearch URL configurable - or at least support localhost and production
* Handle speakers. Make sure that we can search/aggregate speakers. Probably make them their own type as well - need to store some info on what session(s) they have.
* Dynamic mappings for raw field perhaps


