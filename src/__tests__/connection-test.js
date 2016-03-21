import { expect } from 'chai';
import _ from 'lodash';
import r from 'rethinkdb';
import { Environment, schema } from 'nothinkdb';
import Joi from 'joi';
import {
  graphql,
  GraphQLObjectType,
  GraphQLSchema,
} from 'graphql';
import {
  toGlobalId,
} from 'graphql-relay';
import {
  nodeIdToCursor,
  cursorToNodeId,
  pkToCursor,
  cursorToPk,
  pkToOffset,
  applyCursorsToEdgeOffsets,
  edgeOffsetsToReturn,
  dataToEdge,
  connectionArgsToOffsets,
  connectionField,
} from '../connection';
import {
  getGraphQLFieldsFromTable,
} from '../field';
import {
  nodeDefinitionsFromTables,
} from '../node';

const TABLE = 'arrayConnectionTest';

describe('connection', () => {
  let table;
  let connection;
  let orderedQuery;
  let environment;

  before(async () => {
    connection = await r.connect({ db: 'test' });
    environment = new Environment({});
    table = environment.createTable({
      tableName: TABLE,
      schema: () => ({
        ...schema,
      }),
    });
    await environment.sync(connection);
    await table.sync(connection);
    await table.query().delete().run(connection);
    await table.insert(_.times(20, () => ({}))).run(connection);
    orderedQuery = table.query().orderBy('id');
  });

  after(async () => {
    await r.tableDrop(table.tableName).run(connection);
  });

  describe('nodeIdToCursor, cursorToNodeId', () => {
    it('should transform nodeId to cursor, and vice versa', () => {
      const cursor = nodeIdToCursor('example');
      const nodeId = cursorToNodeId(cursor);
      expect(cursor).to.not.equal('example');
      expect(nodeId).to.equal('example');
    });
  });

  describe('pkToCursor & cursorToPk', () => {
    it('should transform pk to cursor, and vice versa', () => {
      const cursor = pkToCursor(TABLE, 'example');
      const resourceId = cursorToPk(cursor);
      expect(cursor).to.not.equal('example');
      expect(resourceId).to.equal('example');
    });
  });

  describe('pkToOffset', () => {
    it('should transform pk to offset', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const offset = await pkToOffset(orderedQuery, resource.id).run(connection);
      expect(offset).to.equal(10);
    });
  });

  describe('dataToEdge', () => {
    it('should transform data to edge', async () => {
      const resource = table.query().nth(0).run(connection);
      const edge = dataToEdge(TABLE, resource);

      Joi.assert(edge, {
        cursor: Joi.string().required(),
        node: Joi.object().required(),
      });
    });
  });

  describe('applyCursorsToEdgeOffsets', () => {
    it('should return edgeOffsets of cursors with before', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
      } = await r.expr(
        applyCursorsToEdgeOffsets(orderedQuery, {
          before: pkToCursor(TABLE, resource.id),
        })
      ).run(connection);
      expect(afterOffset).to.equal(0);
      expect(beforeOffset).to.equal(9);
    });

    it('should return edgeOffsets of cursors with after', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
      } = await r.expr(
        applyCursorsToEdgeOffsets(orderedQuery, {
          after: pkToCursor(TABLE, resource.id),
        })
      ).run(connection);
      expect(afterOffset).to.equal(11);
      expect(beforeOffset).to.equal(19);
    });

    it('should return edgeOffsets of cursors with both', async () => {
      const afterResource = await orderedQuery.nth(5).run(connection);
      const beforeResource = await orderedQuery.nth(15).run(connection);
      const {
        afterOffset,
        beforeOffset,
      } = await r.expr(
        applyCursorsToEdgeOffsets(orderedQuery, {
          after: pkToCursor(TABLE, afterResource.id),
          before: pkToCursor(TABLE, beforeResource.id),
        })
      ).run(connection);
      expect(afterOffset).to.equal(6);
      expect(beforeOffset).to.equal(14);
    });
  });

  describe('edgeOffsetsToReturn', () => {
    it('should throws error with first: 0', () => {
      expect(
        () => edgeOffsetsToReturn({
          afterOffset: 0,
          beforeOffset: 19,
        }, {
          first: 0,
        })
      ).to.throw(Error);
    });

    it('should throws error with last: 0', () => {
      expect(
        () => edgeOffsetsToReturn({
          afterOffset: 0,
          beforeOffset: 10,
        }, {
          first: 0,
        })
      ).to.throw(Error);
    });

    it('should throws error with both: 0', () => {
      expect(
        () => edgeOffsetsToReturn({
          afterOffset: 0,
          beforeOffset: 10,
        }, {
          first: 0,
          last: 0,
        })
      ).to.throw(Error);
    });

    it('should return edgeOffsets with first: half', async () => {
      const { startOffset, endOffset } = await r.expr(
        edgeOffsetsToReturn({
          afterOffset: 0,
          beforeOffset: 19,
        }, {
          first: 10,
        })
      ).run(connection);
      expect(startOffset).to.equal(0);
      expect(endOffset).to.equal(9);
    });

    it('should return edgeOffsets with last: half', async () => {
      const { startOffset, endOffset } = await r.expr(
        edgeOffsetsToReturn({
          afterOffset: 0,
          beforeOffset: 19,
        }, {
          last: 10,
        })
      ).run(connection);
      expect(startOffset).to.equal(10);
      expect(endOffset).to.equal(19);
    });

    it('should return edgeOffsets with both', async () => {
      const { startOffset, endOffset } = await r.expr(
        edgeOffsetsToReturn({
          afterOffset: 0,
          beforeOffset: 9,
        }, {
          first: 9,
          last: 8,
        })
      ).run(connection);
      expect(startOffset).to.equal(1);
      expect(endOffset).to.equal(8);
    });
  });

  describe('connectionArgsToOffsets', () => {
    it('should return offsets with before', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
        startOffset,
        endOffset,
      } = await r.expr(
        connectionArgsToOffsets(orderedQuery, {
          before: pkToCursor(TABLE, resource.id),
        })
      ).run(connection);
      expect(afterOffset).to.equal(0);
      expect(beforeOffset).to.equal(9);
      expect(startOffset).to.equal(0);
      expect(endOffset).to.equal(9);
    });

    it('should return offsets with before & first', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
        startOffset,
        endOffset,
      } = await r.expr(
        connectionArgsToOffsets(orderedQuery, {
          before: pkToCursor(TABLE, resource.id),
          first: 5,
        })
      ).run(connection);
      expect(afterOffset).to.equal(0);
      expect(beforeOffset).to.equal(9);
      expect(startOffset).to.equal(0);
      expect(endOffset).to.equal(4);
    });

    it('should return offsets with before & last', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
        startOffset,
        endOffset,
      } = await r.expr(
        connectionArgsToOffsets(orderedQuery, {
          before: pkToCursor(TABLE, resource.id),
          last: 5,
        })
      ).run(connection);
      expect(afterOffset).to.equal(0);
      expect(beforeOffset).to.equal(9);
      expect(startOffset).to.equal(5);
      expect(endOffset).to.equal(9);
    });

    it('should return offsets with after', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
        startOffset,
        endOffset,
      } = await r.expr(
        connectionArgsToOffsets(orderedQuery, {
          after: pkToCursor(TABLE, resource.id),
        })
      ).run(connection);
      expect(afterOffset).to.equal(11);
      expect(beforeOffset).to.equal(19);
      expect(startOffset).to.equal(11);
      expect(endOffset).to.equal(19);
    });

    it('should return offsets with after & first', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
        startOffset,
        endOffset,
      } = await r.expr(
        connectionArgsToOffsets(orderedQuery, {
          after: pkToCursor(TABLE, resource.id),
          first: 5,
        })
      ).run(connection);
      expect(afterOffset).to.equal(11);
      expect(beforeOffset).to.equal(19);
      expect(startOffset).to.equal(11);
      expect(endOffset).to.equal(15);
    });

    it('should return offsets with after & last', async () => {
      const resource = await orderedQuery.nth(10).run(connection);
      const {
        afterOffset,
        beforeOffset,
        startOffset,
        endOffset,
      } = await r.expr(
        connectionArgsToOffsets(orderedQuery, {
          after: pkToCursor(TABLE, resource.id),
          last: 5,
        })
      ).run(connection);
      expect(afterOffset).to.equal(11);
      expect(beforeOffset).to.equal(19);
      expect(startOffset).to.equal(15);
      expect(endOffset).to.equal(19);
    });

    it('should return offsets with after & before', async () => {
      const afterResource = await orderedQuery.nth(5).run(connection);
      const beforeResource = await orderedQuery.nth(15).run(connection);
      const {
        afterOffset,
        beforeOffset,
        startOffset,
        endOffset,
      } = await r.expr(
        connectionArgsToOffsets(orderedQuery, {
          after: pkToCursor(TABLE, afterResource.id),
          before: pkToCursor(TABLE, beforeResource.id),
        })
      ).run(connection);
      expect(afterOffset).to.equal(6);
      expect(beforeOffset).to.equal(14);
      expect(startOffset).to.equal(6);
      expect(endOffset).to.equal(14);
    });
  });

  describe('connectionFieldFromTable', () => {
    it('should return connection field', async () => {
      const { nodeInterface } = nodeDefinitionsFromTables({
        environment,
        graphQLTypes: () => ({
          [table.tableName]: graphQLType,
        }),
      });

      const graphQLType = new GraphQLObjectType({
        name: table.tableName,
        fields: getGraphQLFieldsFromTable(table),
        interfaces: [nodeInterface],
      });

      const queryType = new GraphQLObjectType({
        name: 'Query',
        fields: () => ({
          connection: connectionField({
            table,
            graphQLType,
            query: orderedQuery,
            connection: () => r.connect(),
          }),
        }),
      });

      const Schema = new GraphQLSchema({
        query: queryType,
      });

      const query = `{
        connection(first: 2) {
          pageInfo {
            hasNextPage
            hasPreviousPage
            endCursor
            startCursor
          }
          edges {
            cursor
            node {
              id
            }
          }
        }
      }`;
      const data = await orderedQuery.slice(0, 2).run(connection);
      return expect(graphql(Schema, query)).to.become({
        data: {
          connection: {
            pageInfo: {
              hasNextPage: true,
              hasPreviousPage: false,
              endCursor: pkToCursor(table.tableName, data[1].id),
              startCursor: pkToCursor(table.tableName, data[0].id),
            },
            edges: [{
              cursor: pkToCursor(table.tableName, data[0].id),
              node: {
                id: toGlobalId(table.tableName, data[0].id),
              },
            }, {
              cursor: pkToCursor(table.tableName, data[1].id),
              node: {
                id: toGlobalId(table.tableName, data[1].id),
              },
            }],
          },
        },
      });
    });
  });
});
