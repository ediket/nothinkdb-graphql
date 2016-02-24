import _ from 'lodash';
import {
  nodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitionsFromTables(options = {}) {
  const { tables, connection } = options;

  return nodeDefinitions(
    async (globalId, context) => {
      const { type, id } = fromGlobalId(globalId);

      const table = tables[type];
      // TODO: use isTable
      if (table) return null;

      const resource = await table.query().get(id).run(connection);
      return resource || null;
    },
    (obj) => {
      console.log(obj);
      // if (!obj.getModel) {
      //   return null;
      // }
      // const name = obj.getModel().getTableName();
      // const endpoint = getEndpoint(name);
      // return endpoint.GraphQLType;
    }
  );
}
