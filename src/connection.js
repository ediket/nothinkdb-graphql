/*
  Related Links
  - https://github.com/graphql/graphql-relay-js#connections
  - https://github.com/graphql/graphql-relay-js/blob/master/src/connection/arrayconnection.js
*/
import _ from 'lodash';
import { fromGlobalId, toGlobalId } from 'graphql-relay';
import { GraphQLError } from 'graphql/error';
import r from 'rethinkdb';
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
    cursor: pkToCursor(table.table, pk),
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
