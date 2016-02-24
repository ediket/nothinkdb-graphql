import r from 'rethinkdb';
import { Table } from 'nothinkdb';
import {
  nodeDefinitions,
  fromGlobalId,
} from 'graphql-relay';

export function nodeDefinitionsFromTables(nodes = {}) {
  return nodeDefinitions(
    async (globalId) => {
      const connection = await r.connect({});
      const { type, id } = fromGlobalId(globalId);

      const table = nodes[type].table;

      if (!(table instanceof Table)) {
        return null;
      }
      const resource = await table.query().get(id).run(connection);

      // console.log('1', resource);
      return {
        resource,
        type,
      };
    },
    (obj) => {
      // console.log('nodedefind type', nodes[obj.type].getGraphQLType());
      return nodes[obj.type].getGraphQLType();
      // if (!obj.getModel) {
      //   return null;
      // }
      // const name = obj.getModel().getTableName();
      // const endpoint = getEndpoint(name);
      // return endpoint.GraphQLType;
    }
  );
}
