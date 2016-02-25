import { r } from 'nothinkdb';
import _ from 'lodash';
import {
  nodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitionsFromTables(options = {}) {
  const { environment, graphQLTypes } = options;

  return nodeDefinitions(
    async (globalId) => {
      const connection = await r.connect({});
      const { type, id } = fromGlobalId(globalId);

      if (!environment.hasTable(type)) return null;

      const table = environment.getTable(type);
      const resource = await table.get(id).run(connection);
      if (_.isNull(resource)) return null;

      await connection.close();

      resource._dataType = type;
      return resource;
    },
    (obj) => {
      if (_.isNull(obj)) return null;
      const getGraphQLType = graphQLTypes[obj._dataType];
      return getGraphQLType();
    }
  );
}
