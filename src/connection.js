/* eslint no-param-reassign: 0 */
import assert from 'assert';
import _ from 'lodash';
import r from 'rethinkdb';
import {
  fromGlobalId,
  toGlobalId,
  connectionArgs,
  connectionDefinitions,
} from 'graphql-relay';
import { GraphQLError } from 'graphql/error';
import { base64, unbase64 } from './base64';


const PREFIX = 'arrayconnection:';

export function nodeIdToCursor(nodeId) {
  return base64(PREFIX + nodeId);
}

export function cursorToNodeId(cursor) {
  return unbase64(cursor).substring(PREFIX.length);
}

export function pkToCursor(tableName, pk) {
  return nodeIdToCursor(
    toGlobalId(tableName, pk)
  );
}

export function cursorToPk(cursor) {
  const { id: resourceId } = fromGlobalId(cursorToNodeId(cursor));
  return resourceId;
}

export function dataToEdge(table, data) {
  const pk = data[table.pk];
  return {
    cursor: pkToCursor(table.tableName, pk),
    node: data,
  };
}

export function pkToOffset(query, pk) {
  const offset = query.offsetsOf(row => row('id').eq(pk)).nth(0);
  return offset;
}

export function cursorToOffset(query, cursor) {
  return pkToOffset(query, cursorToPk(cursor));
}

export function assertConnectionArgs({ first, last }) {
  if (!_.isNumber(first) && !_.isNumber(last)) {
    throw new GraphQLError(`'first' or 'last' should be given.`);
  }
  if (_.some([first, last], (amount) => _.isNumber(amount) && amount <= 0)) {
    throw new GraphQLError(`'first' and 'last' must more than 0`);
  }
}

// https://facebook.github.io/relay/graphql/connections.htm#ApplyCursorsToEdges()
export function applyCursorsToQuery(query, { after, before }) {
  return query.slice(
    after ? pkToOffset(query, cursorToPk(after)).add(1) : 0,
    before ? pkToOffset(query, cursorToPk(before)) : undefined,
  );
}

// https://facebook.github.io/relay/graphql/connections.htm#EdgesToReturn()
export function applyLimitsToQuery(query, { first, last }) {
  if (_.isNumber(first)) {
    query = query.limit(first);
  }

  if (_.isNumber(last)) {
    query = query.coerceTo('array').slice(last * -1);
  }

  return query;
}

export function connectionField({
  table,
  graphQLType,
  connect,
  args: optionArgs,
  name = graphQLType.name,
  getQuery = (/* root, args, context */) => table.query().orderBy({ index: r.desc('createdAt') }),
  runQuery = async (query) => {
    assert(_.isFunction(connect), 'connect should be function');
    const connection = await connect();
    const result = await query.run(connection);
    connection.close();
    return result;
  },
  afterQuery = query => query,
}) {
  const { connectionType } = connectionDefinitions({
    nodeType: graphQLType,
    name,
  });

  return {
    type: connectionType,
    args: {
      ...optionArgs,
      ...connectionArgs,
    },
    resolve: async (root, args, context) => {
      const { after, before, first, last } = args;
      assertConnectionArgs({ first, last });

      let query = await getQuery(root, args, context);
      query = applyCursorsToQuery(query, { after, before });
      const edgesLength = await runQuery(query.count());
      query = applyLimitsToQuery(query, { first, last });
      query = afterQuery(query, root, args, context);
      query = query.coerceTo('array');
      const rows = await runQuery(query);

      const edges = rows.map(row => dataToEdge(table, row));
      const firstEdge = _.head(edges);
      const lastEdge = _.last(edges);

      return {
        edges,
        pageInfo: {
          startCursor: firstEdge ? firstEdge.cursor : null,
          endCursor: lastEdge ? lastEdge.cursor : null,
          hasPreviousPage: last !== undefined ?
            edgesLength > last : false,
          hasNextPage: first !== undefined ?
            edgesLength > first : false,
        },
      };
    },
  };
}
