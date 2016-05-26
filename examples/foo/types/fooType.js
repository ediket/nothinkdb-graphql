import {
  getGraphQLFieldsFromTable,
  fieldFromConnectionType,
} from '../../../';
import {
  GraphQLObjectType,
} from 'graphql';
import {
  connectionDefinitions,
} from 'graphql-relay';
import r from 'rethinkdb';
import fooTable from '../tables/fooTable';
import {
  nodeInterface,
  registerType,
} from '../nodeDefinitions';

export const fooFields = getGraphQLFieldsFromTable(fooTable);

const fooType = new GraphQLObjectType({
  name: 'Foo',
  interfaces: [nodeInterface],
  fields: () => ({
    ...fooFields,
  }),
});

registerType({
  table: fooTable,
  type: fooType,
});

export const {
  connectionType: fooConnectionType,
  edgeType: fooEdgeType,
} = connectionDefinitions({ nodeType: fooType });

export const fooConnectionField = fieldFromConnectionType({
  connectionType: fooConnectionType,
  table: fooTable,
  graphQLType: fooType,
  getQuery: () => {
    return fooTable.query().orderBy({ index: r.desc('createdAt') });
  },
  runQuery: async (query) => {
    const connection = await r.connect();
    const result = await query.run(connection);
    connection.close();
    return result;
  },
});

export default fooType;
