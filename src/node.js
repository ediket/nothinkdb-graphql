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
      if (_.isEmpty(type) || _.isEmpty(id)) return null;

      const table = nodes[type].table;

      const resource = await table.get(id).run(connection);

      resource.GraphQLTypeName = 'user';
      await connection.close();
      return resource;
    },
    (obj) => {
      if (_.isNull(obj)) return null;
      const node = nodes[obj.GraphQLTypeName];

      return node.getGraphQLType();
    }
  );
}
