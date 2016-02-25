import r from 'rethinkdb';
import _ from 'lodash';
import {
  nodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitionsFromTables(nodes = {}) {
  return nodeDefinitions(
    async (globalId) => {
      const connection = await r.connect({});
      const { type, id } = fromGlobalId(globalId);

      const node = nodes[type];
      if (_.isUndefined(node)) return null;

      const resource = await node.table.get(id).run(connection);
      if (_.isNull(resource)) return null;

      await connection.close();

      resource._dataType = type;
      return resource;
    },
    (obj) => {
      if (_.isNull(obj)) return null;
      const node = nodes[obj._dataType];

      return node.getGraphQLType();
    }
  );
}
