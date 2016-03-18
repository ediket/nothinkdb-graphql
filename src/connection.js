/* eslint no-param-reassign: 0 */
/*
  Related Links
  - https://github.com/graphql/graphql-relay-js#connections
  - https://github.com/graphql/graphql-relay-js/blob/master/src/connection/arrayconnection.js
*/
import _ from 'lodash';
import { r } from 'nothinkdb';
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

// https://facebook.github.io/relay/graphql/connections.htm#ApplyCursorsToEdgeOffsets()
export function applyCursorsToEdgeOffsets(query, args) {
  const { after, before } = args;

  let afterOffset;
  if (after) {
    afterOffset = cursorToOffset(query, after);
    afterOffset = r.branch(
      afterOffset,
      afterOffset.add(1),
      0
    );
  } else {
    afterOffset = r.expr(0);
  }

  let beforeOffset;
  if (before) {
    beforeOffset = cursorToOffset(query, before);
    beforeOffset = r.branch(
      beforeOffset,
      r.expr([beforeOffset, afterOffset, 0]).max().sub(1),
      0
    );
  } else {
    const lastRow = query.nth(-1);
    beforeOffset = r.branch(
      lastRow,
      query.offsetsOf(lastRow).nth(0),
      0
    );
  }

  return { afterOffset, beforeOffset };
}

// https://facebook.github.io/relay/graphql/connections.htm#EdgesToReturn()
export function edgeOffsetsToReturn({
  afterOffset, beforeOffset,
}, {
  first, last,
}) {
  assertConnectionArgs({ first, last });

  let startOffset = _.isNumber(afterOffset) ? r.expr(afterOffset) : afterOffset;
  let endOffset = _.isNumber(beforeOffset) ? r.expr(beforeOffset) : beforeOffset;

  if (_.isNumber(first)) {
    endOffset = r.branch(
      endOffset.sub(startOffset).add(1).gt(first),
      startOffset.add(first).sub(1),
      endOffset
    );
  }

  if (_.isNumber(last)) {
    startOffset = r.branch(
      endOffset.sub(startOffset).add(1).gt(last),
      r.expr([endOffset.sub(last).add(1), startOffset, 0]).max(),
      startOffset
    );
  }

  return { startOffset, endOffset };
}

export function connectionArgsToOffsets(query, { after, first, before, last }) {
  assertConnectionArgs({ first, last });

  const { afterOffset, beforeOffset } = applyCursorsToEdgeOffsets(
    query, { after, before }
  );

  const { startOffset, endOffset } = edgeOffsetsToReturn(
    { afterOffset, beforeOffset },
    { first, last }
  );

  return { afterOffset, beforeOffset, startOffset, endOffset };
}

export function assertConnectionArgs({ first, last }) {
  if (_.some([first, last], (amount) => _.isNumber(amount) && amount <= 0)) {
    throw new GraphQLError('first and last must more than 0');
  }
}

export function connectionField({
  table,
  graphQLType,
  filterFields,
  connection: getConnection,
  query = table.query().orderBy(r.desc('createdAt')),
}) {
  const { connectionType } = connectionDefinitions({
    nodeType: graphQLType,
    name: graphQLType.name + 'Connection',
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
      const { after, before, last, filters } = args;
      let { first } = args;
      if (_.every([first, last], _.isUndefined)) { first = 10; }

      const relations = getRelationsFromFields(
        getFieldsFromContext(context).edges.node
      );

      if (filters) {
        query = query.filter(filters);
      }

      const { afterOffset, beforeOffset, startOffset, endOffset } =
        await connectionArgsToOffsets(query, { after, before, first, last });


      query = query.slice(startOffset, endOffset.add(1));

      if (_.isObject(relations) && !_.isEmpty(relations)) {
        query = table.withJoin(query, relations);
      }

      const connection = await getConnection();
      const rows = await query.run(connection);
      await connection.close();

      const edges = rows.map(row => dataToEdge(table, row));
      const firstEdge = _.head(edges);
      const lastEdge = _.last(edges);
      const edgesLength = beforeOffset - afterOffset + 1;

      return {
        edges,
        pageInfo: {
          startCursor: firstEdge ? firstEdge.cursor : null,
          endCursor: lastEdge ? lastEdge.cursor : null,
          hasPreviousPage: last !== undefined &&
            startOffset > 0 ?
            edgesLength > last : false,
          hasNextPage: first !== undefined ?
            edgesLength > first : false,
        },
      };
    },
  };
}
