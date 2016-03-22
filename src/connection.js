/* eslint no-param-reassign: 0 */
import _ from 'lodash';
import r from 'rethinkdb';
import {
  fromGlobalId,
  toGlobalId,
  connectionArgs,
  connectionDefinitions,
} from 'graphql-relay';
import { GraphQLInputObjectType } from 'graphql';
import { GraphQLError } from 'graphql/error';
import { base64, unbase64 } from './base64';
import {
  getFieldsFromContext,
  getRelationsFromFields,
} from './context';


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
  if (_.some([first, last], (amount) => _.isNumber(amount) && amount <= 0)) {
    throw new GraphQLError('first and last must more than 0');
  }
}

export function applyFiltersToQuery(query, filters) {
  return query.filter(filters);
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
  filterFields,
  connect,
  query = table.query().orderBy({ index: r.desc('createdAt') }),
}) {
  const { connectionType } = connectionDefinitions({
    nodeType: graphQLType,
    name: graphQLType.name,
  });

  return {
    type: connectionType,
    args: Object.assign({
      ...(filterFields ? {
        filters: {
          name: `${name}Filters`,
          type: new GraphQLInputObjectType({
            name: `${name}FilterFields`,
            fields: filterFields,
          }),
        },
      } : {}),
    }, connectionArgs),
    resolve: async (root, args, context) => {
      const { after, before, first, last, filters } = args;
      assertConnectionArgs({ first, last });

      const relations = getRelationsFromFields(
        getFieldsFromContext(context).edges.node
      );

      let _query = query;

      if (_.isObject(filters) && !_.isEmpty(filters)) {
        _query = applyFiltersToQuery(_query, filters);
      }

      const connection = await connect();

      _query = applyCursorsToQuery(_query, { after, before });

      const edgesLength = await _query.count().run(connection);

      _query = applyLimitsToQuery(_query, { first, last });

      if (_.isObject(relations) && !_.isEmpty(relations)) {
        _query = table.withJoin(_query, relations);
      }

      const rows = await _query.coerceTo('array').run(connection);
      await connection.close();

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
